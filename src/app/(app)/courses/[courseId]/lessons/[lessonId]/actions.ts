"use server"
import { requireUser } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function markLessonComplete(courseId: string, lessonId: string) {
  const user = await requireUser()

  // Verify enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } }
  })
  if (!enrollment) throw new Error("Forbidden: Not enrolled")

  // Idempotent creation of completion record
  const existing = await prisma.lessonCompletion.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } }
  })

  if (!existing) {
    await prisma.lessonCompletion.create({
      data: { userId: user.id, lessonId }
    })
    
    await prisma.auditLog.create({
      data: { action: "LESSON_COMPLETED", entityType: "Lesson", entityId: lessonId, userId: user.id }
    })
  }

  // Update enrollment status if all lessons are completed
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { lessons: true } } }
  })
  
  if (course) {
    const totalLessons = course.sections.flatMap(s => s.lessons).length
    const completions = await prisma.lessonCompletion.count({
      where: { 
        userId: user.id, 
        lesson: { section: { courseId } }
      }
    })

    if (completions >= totalLessons && enrollment.status !== "COMPLETED") {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED" }
      })
    }
  }

  revalidatePath(`/courses/${courseId}/lessons/${lessonId}`)
  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/dashboard`)
}
