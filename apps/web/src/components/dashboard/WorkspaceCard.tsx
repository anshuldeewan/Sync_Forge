import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Briefcase, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface WorkspaceCardProps {
  workspace: any; // Using any as defined in WorkspaceContext for now
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const { user } = useAuth();
  
  // Find current user's role if available in members
  const myMemberInfo = workspace.members?.find((m: any) => m.userId === user?.uid);
  const role = myMemberInfo?.role || 'Member';
  const memberCount = workspace.members?.length;

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-xl line-clamp-1">{workspace.name}</CardTitle>
            <CardDescription className="text-sm">
              Role: <span className="font-medium text-foreground">{role}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      {memberCount !== undefined && (
        <CardContent>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      )}

      <CardFooter className="mt-auto pt-4">
        <Button variant="secondary" className="w-full group" asChild>
          <Link href={`/workspaces/${workspace.id}`}>
            Open Workspace
            <ChevronRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
