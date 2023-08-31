import { ProjectType } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

interface ProjectInfo {
    defaultWorkflows: string[];
    projectName: string;
}

const projectTypesList: Record<ProjectType, ProjectInfo> =
{
    KANBAN: {
        defaultWorkflows: ["Backlog","To Do", "In Progress", "Done"],
        projectName: "Kanban",
    },
    SCRUM: {
        defaultWorkflows: ["Backlog", "To Do", "In Progress", "Review", "Done"],
        projectName: "Scrum",
    }
}

export const projectRouter = createTRPCRouter({
    getAllProjects: protectedProcedure.query(({ ctx }) => {
        return ctx.prisma.project.findMany(
            {
                include: {
                    projectLead: {
                        select: {
                            name: true,
                        },
                    },
                },
            }
        );
    }),
    getProjectById: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
        return ctx.prisma.project.findUnique({
            where: {
                id: input.id,
            },
            include:{
                members: true,
                projectLead : true,
                defaultAssignee: true,
                labels: {
                    include:{
                        issues:{
                            select:{
                                _count:true,
                            }
                        }
                    }
                },
            }
        });
    }
    ),
    //This is also avilable in the userRouter: getUserAllProjects
    getUserProjects: protectedProcedure.query(({ ctx }) => {
        return ctx.prisma.project.findMany({
            where: {
                OR: [
                    {
                        members: {
                            some: {
                                id: ctx.session.user.id,
                            },
                        },
                    },
                    {
                        projectLeadId: ctx.session.user.id,
                    },
                ],
            },
            include: {
                projectLead: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
            },
        });
    }),
    createProject: protectedProcedure.input(z.object({ name: z.string(), projectType: z.nativeEnum(ProjectType),workspaceShortName:z.string() })).mutation(async ({ ctx, input }) => {
        const defaultWorkflows = projectTypesList[input.projectType].defaultWorkflows;
        const workspace = await ctx.prisma.workspace.findFirst({
            where:{
                shortName:input.workspaceShortName
            }
        });
                
        return ctx.prisma.project.create({
            data: {
                name: input.name,
                projectType: input.projectType,
                //DEFAULT set the project lead to the user who created the project
                projectLeadId: ctx.session.user.id,
                //SET the creator as a member of the project as well
                members: {
                    connect: {
                        id: ctx.session.user.id,
                    },
                },
                workflows: {
                    createMany: {
                        data: defaultWorkflows.map((workflow, index) => ({
                            title: workflow,
                            index: index,
                        })),
                        skipDuplicates: true,
                    },
                },
                workspaceId:workspace?.id,
            },
        });
    }),
    updateProject: protectedProcedure.input(z.object({ id: z.string(), name: z.string(), defaultAssigneeId:z.string().nullable(),projectLeadId:z.string() })).mutation(({ ctx, input }) => {
        return ctx.prisma.project.update({
            where: {
                id: input.id,
            },
            data: {
                name: input.name,
                defaultAssigneeId: input.defaultAssigneeId,
                projectLeadId: input.projectLeadId,
            },
        });
    }),
    deleteProject: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        try{
            const projectToDelete = await ctx.prisma.project.findFirst({
                where:{
                    id:input.id
                },
                include:{
                    projectLead : true,
                }
            });
            if (ctx.session.user.id === projectToDelete?.projectLeadId ) {
                return ctx.prisma.project.delete({
                    where: {
                        id: input.id,
                    },
                });
            }else{
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message:"You Dont have access to delete the Project"
                })
            }
            
        }catch(err){
            throw new TRPCError({
                code : "BAD_REQUEST",
                message:"An unexpected error occurred"
            })
        }
    }),

    assignUserToProject: protectedProcedure.input(z.object({ workspaceId:z.string(), projectId: z.string(), userId: z.string() })).mutation(({ ctx, input }) => {
        return ctx.prisma.user.update({
            where: {
                id: input.projectId,
                workspaceId : input.workspaceId,
            },
            data: {
                projects: {
                    connect: {
                        id: input.userId,
                    },
                },
            },
        });
    }),

    getProjectMembers: protectedProcedure.input(z.object({ projectId: z.string() })).query(({ ctx, input }) => {
        return ctx.prisma.project.findUnique({
            where: {
                id: input.projectId,
            },
            select: {
                members: true,
            },
        });
    }),

    getProjectWorkflows: protectedProcedure.input(z.object({ projectId: z.string() })).query(({ ctx, input }) => {
        return ctx.prisma.project.findUniqueOrThrow({
            where: {
                id: input.projectId,
            },
            select: {
                workflows: {
                    orderBy: {
                        index: "asc",
                    },
                    include: {
                        issue: {
                            include: {
                                labels: true,
                                _count: {
                                    select: {
                                        comments: true,
                                        assignees: true,
                                        labels: true,
                                        linkedIssues: true,
                                    },
                                },
                            },
                            orderBy: {
                                index: "asc",
                            },
                        },
                    },
                },
            },
        });
    }),
    createProjectLabels : protectedProcedure.input(z.object({projectId:z.string(),title:z.string().min(4),color:z.string().min(7).max(7),description:z.string().optional()})).mutation(({ctx,input})=>{
        return ctx.prisma.label.create({
            data:{
                title : input.title,
                color : input.color,
                projectId : input.projectId,
                description : input.description,
            },
            include:{
                issues:{
                    select:{
                        _count:true,
                    }
                }
            }
        })
    }),
    getProjectLabels: protectedProcedure.input(z.object({ projectId: z.string() })).query(({ ctx, input }) => {
        return ctx.prisma.label.findMany({
            where: {
                projectId: input.projectId,
            },
            include:{
                issues:{
                    select:{
                        _count:true,
                    }
                }
            }
        });
    }),
    deleteProjectLabel: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
        return ctx.prisma.label.delete({
            where: {
                id: input.id,
            },
            include:{
                issues:{
                    select:{
                        _count:true,
                    }
                }
            }
        });
    }
    ),
    updateProjectLabel: protectedProcedure.input(z.object({ id: z.string(), title: z.string(),description:z.string().optional().nullable(), color: z.string().min(7).max(7) })).mutation(({ ctx, input }) => {
        return ctx.prisma.label.update({
            where: {
                id: input.id,
            },
            data: {
                title: input.title,
                color: input.color,
                description:input.description,
            },
            include:{
                issues:{
                    select:{
                        _count:true,
                    }
                }
            }
        });
    }),
}
);