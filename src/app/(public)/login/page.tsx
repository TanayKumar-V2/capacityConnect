import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignJWT } from "jose";
import { BookOpen, User, ArrowLeft, Lock, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";

export default async function LoginPage(props: { searchParams: Promise<{ mode?: string, error?: string }> }) {
  const searchParams = await props.searchParams;
  const mode = searchParams.mode === 'register' ? 'register' : 'login';
  const error = searchParams.error;

  async function handleAuth(formData: FormData) {
    "use server"
    
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const actionMode = formData.get('mode') as string;
    const role = formData.get('role') as string;
    
    if (!email || !password || password.length < 4) {
      redirect(`/login?mode=${actionMode}&error=Invalid credentials`);
    }

    let assignedRole = 'learner';
    let dbUser = await prisma.user.findUnique({ where: { email } });

    if (actionMode === 'register') {
      if (dbUser) {
        redirect(`/login?mode=register&error=User already exists`);
      }
      
      assignedRole = role || 'learner';
      const roleRecord = await prisma.role.findUnique({
        where: { name: assignedRole.toUpperCase() }
      });
      
      dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash: password, // In a real app, hash the password
          firstName: email.split('@')[0],
          lastName: 'User',
          roles: roleRecord ? {
            create: { roleId: roleRecord.id }
          } : undefined
        }
      });
    } else {
      if (!dbUser || dbUser.passwordHash !== password) {
        redirect(`/login?mode=login&error=Invalid credentials`);
      }
      
      const userRoles = await prisma.userRole.findMany({
        where: { userId: dbUser.id },
        include: { role: true }
      });
      if (userRoles.length > 0) {
        assignedRole = userRoles[0].role.name.toLowerCase();
      }
    }
    
    const jwtSecretStr = process.env.JWT_SECRET
    if (!jwtSecretStr || jwtSecretStr.length < 32) {
      throw new Error('CRITICAL: JWT_SECRET environment variable is missing or less than 32 characters.')
    }
    const secret = new TextEncoder().encode(jwtSecretStr)
    const token = await new SignJWT({ email, role: assignedRole })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('capacity-connect')
      .setAudience('capacity-connect-users')
      .setExpirationTime('8h')
      .sign(secret)

    const cookieStore = await cookies();
    cookieStore.set('demo_session_token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 // 8 hours
    });
    
    cookieStore.delete('demo_user_email');
    
    redirect('/dashboard');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background flex-col relative overflow-hidden transition-colors duration-300">
      {/* Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="absolute top-6 left-6 z-50">
        <Button variant="ghost" size="sm" className="rounded-full hover:bg-white/10" asChild>
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
        </Button>
      </div>

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md bg-background/50 backdrop-blur-xl border-white/10 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="text-center pb-6 pt-10">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-white/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {mode === 'register' ? 'Create an Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {mode === 'register' ? 'Sign up for Capacity Connect.' : 'Sign in to your Capacity Connect account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 px-8">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive text-center">
              {error}
            </div>
          )}
          
          <form action={handleAuth} className="space-y-4">
            <input type="hidden" name="mode" value={mode} />
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="pl-10 h-10"
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                  className="pl-10 h-10"
                  required 
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue="learner">
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="learner">Learner</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full h-11 mt-2 text-base shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
              {mode === 'register' ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm">
            {mode === 'login' ? (
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/login?mode=register" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login?mode=login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-sm text-muted-foreground relative z-10">
        Secure environment
      </p>
    </div>
  )
}
