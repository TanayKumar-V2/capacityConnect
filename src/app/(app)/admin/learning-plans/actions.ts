"use server"

import { requireRole } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createLearningPlan(formData: FormData) {
  const user = await requireRole(['ADMIN'])

  const title = formData.get("title")?.toString().trim()
  const description = formData.get("description")?.toString().trim()
  const targetAudience = formData.get("targetAudience")?.toString().trim()
  
  if (!title) {
    throw new Error("Title is required.")
  }

  const plan = await prisma.learningPlan.create({
    data: {
      title,
      description: description || null,
      targetAudience: targetAudience || null,
    }
  })

  await prisma.auditLog.create({
    data: { action: "LEARNING_PLAN_CREATED", entityType: "LearningPlan", entityId: plan.id, userId: user.id }
  })

  redirect(`/admin/learning-plans/${plan.id}`)
}

export async function addCourseToPlan(planId: string, formData: FormData) {
  const user = await requireRole(['ADMIN'])
  const courseId = formData.get("courseId")?.toString().trim()
  
  if (!courseId) throw new Error("Course ID required.")

  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course || !course.isPublished) {
    throw new Error("Only published courses can be added to a Learning Plan.")
  }

  const existingItem = await prisma.learningPlanItem.findUnique({
    where: { learningPlanId_courseId: { learningPlanId: planId, courseId } }
  })
  
  if (existingItem) {
    throw new Error("This course is already in the Learning Plan.")
  }

  const count = await prisma.learningPlanItem.count({ where: { learningPlanId: planId } })

  await prisma.learningPlanItem.create({
    data: {
      learningPlanId: planId,
      courseId,
      order: count
    }
  })

  await prisma.auditLog.create({
    data: { action: "LEARNING_PLAN_ITEM_ADDED", entityType: "LearningPlan", entityId: planId, userId: user.id, metadata: `courseId:${courseId}` }
  })

  revalidatePath(`/admin/learning-plans/${planId}`)
}

export async function assignPlanToLearner(planId: string, formData: FormData) {
  const user = await requireRole(['ADMIN'])
  const userId = formData.get("userId")?.toString().trim()
  
  if (!userId) throw new Error("User ID required.")

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) throw new Error("User not found.")

  const existingAssignment = await prisma.learningPlanAssignment.findUnique({
    where: { userId_learningPlanId: { userId, learningPlanId: planId } }
  })
  
  if (!existingAssignment) {
    await prisma.learningPlanAssignment.create({
      data: {
        learningPlanId: planId,
        userId
      }
    })

    await prisma.auditLog.create({
      data: { action: "LEARNING_PLAN_ASSIGNED", entityType: "LearningPlan", entityId: planId, userId: user.id, metadata: `assignedUserId:${userId}` }
    })
  }

  revalidatePath(`/admin/learning-plans/${planId}`)
}
