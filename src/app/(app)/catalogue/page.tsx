import { Input } from "@/components/ui/input"
import { Search, BookOpen } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function CourseCatalogue() {
  const user = await getCurrentUser()
  const publishedCourses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: {
      enrollments: {
        where: { userId: user?.id }
      }
    }
  })

  async function enrollInCourse(courseId: string) {
    "use server"
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be logged in to enroll")

    const course = await prisma.course.findUnique({ where: { id: courseId }})
    if (!course?.isPublished) throw new Error("Course not available")

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } }
    })

    if (!existing) {
      await prisma.enrollment.create({
        data: { userId: user.id, courseId, status: "IN_PROGRESS" }
      })
      await prisma.auditLog.create({
        data: { action: "ENROLLMENT_CREATED", entityType: "Course", entityId: courseId, userId: user.id }
      })
    }
    
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Course Catalogue</h1>
          <p className="text-muted-foreground mt-2">
            Browse and enroll in available courses.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search courses..." className="pl-8" />
        </div>
      </div>
      
      {publishedCourses.length === 0 ? (
        <div className="bg-background/40 backdrop-blur-xl border-white/10 rounded-xl p-12 text-center shadow-sm">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary">No courses available</h3>
          <p className="text-muted-foreground mt-2">Check back later for new learning materials.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {publishedCourses.map((course) => {
            const isEnrolled = course.enrollments.length > 0;
            return (
              <div key={course.id} className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col group">
                <div className="h-32 bg-primary/5 border border-primary/10 rounded-md mb-4 flex items-center justify-center transition-colors group-hover:bg-primary/10">
                  <BookOpen className="h-8 w-8 text-primary/40 group-hover:text-primary/60 transition-colors" />
                </div>
                <h3 className="font-semibold text-primary">{course.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 flex-grow">
                  {course.summary || course.description || 'No description provided.'}
                </p>
                <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Self-paced</span>
                  {isEnrolled ? (
                    <Button variant="secondary" size="sm" className="rounded-full shadow-sm hover:scale-105 transition-transform" asChild>
                       <a href="/dashboard">Continue</a>
                    </Button>
                  ) : (
                    <form action={enrollInCourse.bind(null, course.id)}>
                      <Button type="submit" size="sm" className="rounded-full shadow-md shadow-primary/20 hover:scale-105 transition-transform">Enroll</Button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
