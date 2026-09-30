import { requireRole } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { redirect } from "next/navigation"

export default async function CreateCoursePage() {
  await requireRole(['TRAINER'])

  async function createCourse(formData: FormData) {
    "use server"
    const user = await requireRole(['TRAINER'])
    const title = formData.get("title") as string
    const summary = formData.get("summary") as string
    const description = formData.get("description") as string

    if (!title) {
      throw new Error("Title is required")
    }

    const course = await prisma.course.create({
      data: {
        title,
        summary,
        description,
        isPublished: false,
        ownerId: user.id
      }
    })

    await prisma.auditLog.create({
      data: {
        action: "COURSE_CREATED",
        entityType: "Course",
        entityId: course.id,
        userId: user.id
      }
    })

    redirect(`/trainer/courses/${course.id}`)
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Create New Course</h1>
        <p className="text-muted-foreground mt-2">
          Start by providing basic information. You can add sections and lessons later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Metadata</CardTitle>
          <CardDescription>Enter the initial details for this course.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCourse} className="flex flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Course Title</label>
              <Input id="title" name="title" required placeholder="e.g. Advanced Radar Interpretation" />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="summary" className="text-sm font-medium">Short Summary</label>
              <Input id="summary" name="summary" placeholder="Brief overview for the catalogue cards" />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Full Description</label>
              <Textarea 
                id="description" 
                name="description" 
                rows={5}
                placeholder="Detailed explanation of the course content and objectives." 
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" type="button" asChild>
                <a href="/trainer/dashboard">Cancel</a>
              </Button>
              <Button type="submit">Create Draft</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
