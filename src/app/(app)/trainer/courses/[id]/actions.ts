"use server"

import { requireRole, canManageCourse } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export async function addSection(courseId: string, formData: FormData) {
  const user = await requireRole(['TRAINER'])
  await canManageCourse(courseId)

  const title = formData.get("title")?.toString().trim()
  if (!title) throw new Error("Title is required")

  const count = await prisma.courseSection.count({ where: { courseId } })

  await prisma.courseSection.create({
    data: {
      courseId,
      title,
      order: count
    }
  })

  await prisma.auditLog.create({
    data: { action: "SECTION_CREATED", entityType: "Course", entityId: courseId, userId: user.id }
  })

  revalidatePath(`/trainer/courses/${courseId}`)
}

export async function addLesson(courseId: string, sectionId: string, formData: FormData) {
  const user = await requireRole(['TRAINER'])
  await canManageCourse(courseId)

  const section = await prisma.courseSection.findUnique({ where: { id: sectionId } })
  if (!section || section.courseId !== courseId) throw new Error("Invalid section")

  const title = formData.get("title")?.toString().trim()
  const content = formData.get("content")?.toString().trim()
  
  if (!title) throw new Error("Title is required")

  const count = await prisma.lesson.count({ where: { sectionId } })

  await prisma.lesson.create({
    data: {
      sectionId,
      title,
      content,
      order: count
    }
  })

  await prisma.auditLog.create({
    data: { action: "LESSON_CREATED", entityType: "Course", entityId: courseId, userId: user.id }
  })

  revalidatePath(`/trainer/courses/${courseId}`)
}

export async function publishCourse(courseId: string) {
  const user = await requireRole(['TRAINER'])
  await canManageCourse(courseId)

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        include: { lessons: true }
      }
    }
  })

  if (!course) throw new Error("Course not found")
  if (!course.title.trim() || !course.description?.trim()) {
    throw new Error("Course must have a title and description to be published.")
  }

  if (course.sections.length === 0) {
    throw new Error("Course must have at least one section.")
  }

  const hasValidLesson = course.sections.some(s => 
    s.lessons.some(l => l.title.trim() && l.content?.trim())
  )

  if (!hasValidLesson) {
    throw new Error("Course must have at least one lesson with content.")
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: true }
  })

  await prisma.auditLog.create({
    data: { action: "COURSE_PUBLISHED", entityType: "Course", entityId: courseId, userId: user.id }
  })

  revalidatePath(`/trainer/courses/${courseId}`)
}
