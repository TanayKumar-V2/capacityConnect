import { requireRole } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string, action?: string, userId?: string }
}) {
  await requireRole(['ADMIN'])

  const page = parseInt(searchParams.page || "1") || 1
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const filterAction = searchParams.action
  const filterActorId = searchParams.userId

  // Safe query construction
  const where: Record<string, unknown> = {}
  if (filterAction && filterAction !== 'ALL') {
    where.action = filterAction
  }
  if (filterActorId) {
    where.userId = filterActorId
  }

  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    })
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  // Get unique actions for filter dropdown
  const uniqueActions = await prisma.auditLog.findMany({
    select: { action: true },
    distinct: ['action']
  })

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">System Audit Logs</h1>
        <p className="text-muted-foreground mt-2">
          Read-only view of all recorded system mutations and security events.
        </p>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-lg">Filter Events</CardTitle>
          <CardDescription>Search by specific actions or user IDs.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="flex flex-col sm:flex-row gap-4 items-end" method="GET" action="/admin/audit-logs">
             <div className="flex-1 space-y-2 w-full">
               <label className="text-sm font-medium">Action Type</label>
               <select name="action" defaultValue={filterAction || 'ALL'} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                 <option value="ALL">All Actions</option>
                 {uniqueActions.map((a) => (
                   <option key={a.action} value={a.action}>{a.action}</option>
                 ))}
               </select>
             </div>
             
             <div className="flex-1 space-y-2 w-full">
               <label className="text-sm font-medium">Actor ID</label>
               <Input name="userId" placeholder="UUID of the acting user" defaultValue={filterActorId} />
             </div>

             <Button type="submit" className="w-full sm:w-auto h-10">
               <Search className="w-4 h-4 mr-2" /> Apply Filters
             </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor ID</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-secondary/20">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.userId || "System"}</TableCell>
                    <TableCell className="text-sm font-medium">{log.entityType}</TableCell>
                    <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.metadata || ""}>
                      {log.metadata || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalCount} total logs)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                <a href={`/admin/audit-logs?page=${page - 1}&action=${filterAction || ''}&userId=${filterActorId || ''}`}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
                <a href={`/admin/audit-logs?page=${page + 1}&action=${filterAction || ''}&userId=${filterActorId || ''}`}>
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
