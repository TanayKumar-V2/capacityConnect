import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"

export async function POST(request: NextRequest) {
  const pdfParse = require("pdf-parse")
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userRoles = user.roles.map(r => r.role.name)
  if (!userRoles.includes("TRAINER") && !userRoles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden: Trainers only" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const courseId = formData.get("courseId") as string | null
    const lessonId = formData.get("lessonId") as string | null
    const displayName = formData.get("displayName") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    // Verify course ownership
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    
    if (course.ownerId !== user.id && !userRoles.includes("ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Not the course owner" }, { status: 403 })
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Invalid file type. Only PDF is allowed." }, { status: 400 })
    }

    // Validate size (10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    // Save to local storage
    const { storageKey, sizeBytes } = await storage.save(file)

    // Run bounded PDF extraction
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    let extractedText = null
    let indexingStatus = "PENDING"
    
    try {
      const pdfData = await pdfParse(fileBuffer, { max: 100 }) // limit to first 100 pages for prototype
      if (pdfData.text && pdfData.text.length > 0) {
         extractedText = pdfData.text.substring(0, 100000) // cap text length to prevent DB bloating
         indexingStatus = "SUCCESS"
      } else {
         indexingStatus = "FAILED" // Empty PDF or unparseable
      }
    } catch (parseError) {
      console.warn("PDF extraction failed, marking resource as failed index:", parseError)
      indexingStatus = "FAILED"
    }

    // Save metadata to database
    try {
      const resource = await prisma.resource.create({
        data: {
          displayName: displayName || file.name,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes,
          storageKey,
          courseId,
          lessonId,
          uploaderId: user.id,
          extractedText,
          indexingStatus
        }
      })

      await prisma.auditLog.create({
        data: {
          action: "RESOURCE_UPLOADED",
          entityType: "Resource",
          entityId: resource.id,
          userId: user.id,
          metadata: `courseId:${courseId}, indexingStatus:${indexingStatus}`
        }
      })

      return NextResponse.json({ success: true, resource })
    } catch (dbError) {
      // Cleanup if DB fails
      await storage.delete(storageKey)
      console.error("Database failure during upload, cleaned up storage:", dbError)
      return NextResponse.json({ error: "Failed to save resource metadata" }, { status: 500 })
    }

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload processing failed" }, { status: 500 })
  }
}
