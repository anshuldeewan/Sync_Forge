import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { FolderGit2, ChevronRight, Clock, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: any;
  workspaceId: string;
  canDelete: boolean;
  onDelete: (e: React.MouseEvent) => void;
}

export function ProjectCard({ project, workspaceId, canDelete, onDelete }: ProjectCardProps) {
  return (
    <Card className="group flex flex-col transition-all duration-200 hover:shadow-md hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/20">
              <FolderGit2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-xl line-clamp-1">{project.name}</CardTitle>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto pt-4 flex gap-2">
        <Link href={`/workspaces/${workspaceId}/projects/${project.id}`} passHref legacyBehavior>
          <Button variant="secondary" className="flex-1 group/btn">
            Open Project
            <ChevronRight className="ml-2 h-4 w-4 opacity-70 group-hover/btn:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
        {canDelete && (
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={onDelete} title="Delete Project">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
