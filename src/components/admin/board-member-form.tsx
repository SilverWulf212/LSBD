"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { boardMemberSchema } from "@/lib/validators";
import { createBoardMember, updateBoardMember } from "@/actions/board-members";
import { PdfUpload } from "@/components/admin/pdf-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BoardMember } from "@/types";
import type { z } from "zod";

type BoardMemberFormValues = z.output<typeof boardMemberSchema>;
type BoardMemberFormInput = z.input<typeof boardMemberSchema>;

const roleLabels: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary/Treasurer",
  member: "Member",
  hygienist_representative: "Hygienist Representative",
  consumer_member: "Consumer Member",
};

interface BoardMemberFormProps {
  boardMember?: BoardMember | null;
}

export function BoardMemberForm({ boardMember }: BoardMemberFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<BoardMemberFormInput, unknown, BoardMemberFormValues>({
    resolver: zodResolver(boardMemberSchema),
    defaultValues: {
      name: boardMember?.name ?? "",
      honorific: boardMember?.honorific ?? "",
      credential: boardMember?.credential ?? "",
      role: boardMember?.role ?? "member",
      district: boardMember?.district ?? "",
      imageUrl: boardMember?.imageUrl ?? "",
      isActive: boardMember?.isActive ?? true,
      sortOrder: boardMember?.sortOrder ?? 0,
    },
  });

  function onSubmit(values: BoardMemberFormValues) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", values.name);
        formData.set("honorific", values.honorific ?? "");
        formData.set("credential", values.credential ?? "");
        formData.set("role", values.role);
        formData.set("district", values.district ?? "");
        formData.set("imageUrl", values.imageUrl ?? "");
        formData.set("isActive", String(values.isActive));
        formData.set("sortOrder", String(values.sortOrder));

        if (boardMember) {
          await updateBoardMember(boardMember.id, formData);
        } else {
          await createBoardMember(formData);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save board member."
        );
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Member Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="honorific"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Honorific</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr., Mr., etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            aria-required="true"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="credential"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credentials</FormLabel>
                        <FormControl>
                          <Input placeholder="DDS, DMD, RDH, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District</FormLabel>
                        <FormControl>
                          <Input placeholder="District 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Show on the public board page
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="Toggle active status"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value as number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Saving...
                    </>
                  ) : boardMember ? (
                    "Update Member"
                  ) : (
                    "Create Member"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Headshot</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Headshot image</FormLabel>
                      <FormControl>
                        <div>
                          {field.value ? (
                            <div className="space-y-3">
                              <img
                                src={field.value}
                                alt="Board member headshot"
                                className="w-32 h-32 rounded-full mx-auto object-cover border"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => field.onChange("")}
                                className="w-full"
                              >
                                Remove Image
                              </Button>
                            </div>
                          ) : (
                            <PdfUpload
                              accept=".jpg,.jpeg,.png,.webp"
                              folder="board"
                              label="Upload headshot"
                              onUpload={(result) => field.onChange(result.url)}
                              onRemove={() => field.onChange("")}
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
