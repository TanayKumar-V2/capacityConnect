"use server"

import { requireRole } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createCompetency(formData: FormData) {
  const user = await requireRole(['ADMIN'])

  const name = formData.get("name")?.toString().trim()
  const key = formData.get("key")?.toString().trim()
  const description = formData.get("description")?.toString().trim()
  const category = formData.get("category")?.toString().trim()

  if (!name || !key) {
    throw new Error("Name and Key are required fields.")
  }

  const existing = await prisma.competency.findUnique({ where: { key } })
  if (existing) {
    throw new Error("A competency with this key already exists.")
  }

  const competency = await prisma.competency.create({
    data: {
      name,
      key,
      description: description || null,
      category: category || null,
    }
  })

  await prisma.auditLog.create({
    data: {
      action: "COMPETENCY_CREATED",
      entityType: "Competency",
      entityId: competency.id,
      userId: user.id
    }
  })

  revalidatePath('/admin/competencies')
}

export async function archiveCompetency(id: string) {
  const user = await requireRole(['ADMIN'])

  await prisma.competency.update({
    where: { id },
    data: { isArchived: true }
  })

  await prisma.auditLog.create({
    data: {
      action: "COMPETENCY_ARCHIVED",
      entityType: "Competency",
      entityId: id,
      userId: user.id
    }
  })

  revalidatePath('/admin/competencies')
}
