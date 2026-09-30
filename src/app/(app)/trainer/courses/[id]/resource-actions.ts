"use server"

import { requireRole, canManageCourse } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { revalidatePath } from "next/cache"
import fs from "fs/promises"

export async function deleteResource(courseId: string, resourceId: string) {
  const user = await requireRole(['TRAINER', 'ADMIN'])
  await canManageCourse(courseId)

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  })

  if (!resource || resource.courseId !== courseId) {
    throw new Error("Resource not found or does not belong to this course.")
  }

  // Delete from DB first
  await prisma.resource.delete({
    where: { id: resourceId }
  })

  // Then delete from storage
  await storage.delete(resource.storageKey)

  await prisma.auditLog.create({
    data: {
      action: "RESOURCE_DELETED",
      entityType: "Resource",
      entityId: resourceId,
      userId: user.id
    }
  })

  revalidatePath(`/trainer/courses/${courseId}`)
}

export async function retryIndexing(courseId: string, resourceId: string) {
  const user = await requireRole(['TRAINER', 'ADMIN'])
  await canManageCourse(courseId)

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  })

  if (!resource || resource.courseId !== courseId) {
    return { error: "Resource not found or unauthorized." }
  }

  if (resource.indexingStatus !== "FAILED") {
    return { error: "Can only retry extraction for failed resources." }
  }

  let extractedText = null
  let finalStatus = "FAILED"
  
  try {
    // We need to fetch the local file buffer based on the storage key
    // For this prototype, the local storage adapter writes to `.storage/`
    // Ensure we do not accept client paths, strictly use the DB storageKey
    const filePath = `.storage/${resource.storageKey}`
    const fileBuffer = await fs.readFile(filePath)
    const pdfParse = require("pdf-parse")
    const pdfData = await pdfParse(fileBuffer, { max: 100 })
    if (pdfData.text && pdfData.text.length > 0) {
       extractedText = pdfData.text.substring(0, 100000)
       finalStatus = "SUCCESS"
    } else {
       finalStatus = "FAILED"
    }
  } catch (error) {
    console.warn("Retry indexing failed:", error)
    finalStatus = "FAILED"
  }

  // Update DB atomically, ensuring it hasn't succeeded via a concurrent request
  await prisma.resource.updateMany({
    where: { 
      id: resourceId,
      indexingStatus: "FAILED"
    },
    data: {
      extractedText,
      indexingStatus: finalStatus
    }
  })

  await prisma.auditLog.create({
    data: {
      action: "RESOURCE_INDEX_RETRY",
      entityType: "Resource",
      entityId: resourceId,
      userId: user.id,
      metadata: `outcome:${finalStatus}`
    }
  })

  revalidatePath(`/trainer/courses/${courseId}`)
  
  return { 
    success: finalStatus === "SUCCESS", 
    message: finalStatus === "SUCCESS" ? "Extraction successful." : "Extraction failed again." 
  }
}
