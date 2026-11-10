CREATE TABLE public."UserWorkspacePreference" (
 "userId" TEXT NOT NULL PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 configuration JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserWorkspacePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
