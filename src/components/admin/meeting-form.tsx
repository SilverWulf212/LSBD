"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { meetingSchema } from "@/lib/validators";
import { MEETING_TYPES } from "@/lib/constants";
import { createMeeting, updateMeeting, addMeetingDocument, deleteMeetingDocument } from "@/actions/meetings";
import { PdfUpload } from "@/components/admin/pdf-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useRouter } from "next/navigation";
import { formatFileSize } from "@/lib/utils";
import type { MeetingWithDocuments, MeetingDocument } from "@/types";
import type { z } from "zod";

type MeetingFormValues = z.infer<typeof meetingSchema>;

const docTypes = [
  { key: "notice" as const, label: "Notice" },
  { key: "agenda" as const, label: "Agenda" },
  { key: "minutes" as const, label: "Minutes" },
];

interface MeetingFormProps {
  meeting?: MeetingWithDocuments | null;
}

export function MeetingForm({ meeting }: MeetingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: meeting?.title ?? "",
      meetingDate: meeting?.meetingDate
        ? new Date(meeting.meetingDate).toISOString().slice(0, 16)
        : "",
      description: meeting?.description ?? "",
      meetingType: meeting?.meetingType ?? "board",
      isPublished: meeting?.isPublished ?? true,
    },
  });

  function onSubmit(values: MeetingFormValues) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", values.title);
        formData.set("meetingDate", values.meetingDate);
        formData.set("description", values.description ?? "");
        formData.set("meetingType", values.meetingType);
        formData.set("isPublished", String(values.isPublished));

        if (meeting) {
          await updateMeeting(meeting.id, formData);
        } else {
          await createMeeting(formData);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save meeting."
        );
      }
    });
  }

  function getDocForType(docType: string): MeetingDocument | undefined {
    return meeting?.documents.find((d) => d.docType === docType);
  }

  async function handleDocUpload(
    docType: "notice" | "agenda" | "minutes",
    result: { url: string; pathname: string; size: number }
  ) {
    if (!meeting) return;
    try {
      await addMeetingDocument(meeting.id, docType, {
        ...result,
        title: `${docType.charAt(0).toUpperCase() + docType.slice(1)} - ${meeting.title}`,
      });
      toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} uploaded.`);
      router.refresh();
    } catch {
      toast.error("Failed to save document.");
    }
  }

  async function handleDocRemove(docId: number) {
    try {
      await deleteMeetingDocument(docId);
      toast.success("Document removed.");
      router.refresh();
    } catch {
      toast.error("Failed to remove document.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Board Meeting - January 2026"
                          aria-required="true"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="meetingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Date &amp; Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            aria-required="true"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="meetingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MEETING_TYPES.map((type) => (
                              <SelectItem key={type.key} value={type.key}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional details about this meeting"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Document uploads — only shown for existing meetings */}
            {meeting && (
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {docTypes.map((dt) => {
                    const doc = getDocForType(dt.key);
                    return (
                      <div key={dt.key}>
                        <h3 className="text-sm font-medium mb-2">
                          {dt.label}
                        </h3>
                        <PdfUpload
                          folder="meetings"
                          label={`Upload ${dt.label.toLowerCase()}`}
                          currentFile={
                            doc
                              ? {
                                  url: doc.blobUrl,
                                  name: doc.title,
                                  size: doc.fileSizeBytes ?? 0,
                                }
                              : undefined
                          }
                          onUpload={(result) => handleDocUpload(dt.key, result)}
                          onRemove={
                            doc ? () => handleDocRemove(doc.id) : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="isPublished"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Published</FormLabel>
                        <FormDescription>
                          Show on the public site
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="Toggle published status"
                        />
                      </FormControl>
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
                  ) : meeting ? (
                    "Update Meeting"
                  ) : (
                    "Create Meeting"
                  )}
                </Button>

                {!meeting && (
                  <p className="text-xs text-muted-foreground">
                    After creating the meeting, you can upload documents
                    (notice, agenda, minutes).
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
