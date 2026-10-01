"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicationSchema } from "@/lib/validators";
import { createPublication, updatePublication } from "@/actions/publications";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Publication } from "@/types";
import type { z } from "zod";

type PublicationFormValues = z.output<typeof publicationSchema>;
type PublicationFormInput = z.input<typeof publicationSchema>;

interface PublicationFormProps {
  publication?: Publication | null;
}

export function PublicationForm({ publication }: PublicationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [fileData, setFileData] = useState<{
    url: string;
    pathname: string;
    size: number;
  } | null>(
    publication?.blobUrl
      ? {
          url: publication.blobUrl,
          pathname: publication.blobPathname,
          size: publication.fileSizeBytes ?? 0,
        }
      : null
  );

  const form = useForm<PublicationFormInput, unknown, PublicationFormValues>({
    resolver: zodResolver(publicationSchema),
    defaultValues: {
      title: publication?.title ?? "",
      year: publication?.year ?? new Date().getFullYear(),
      description: publication?.description ?? "",
      isPublished: publication?.isPublished ?? true,
    },
  });

  function onSubmit(values: PublicationFormValues) {
    if (!fileData) {
      toast.error("Please upload a PDF file.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", values.title);
        formData.set("year", String(values.year));
        formData.set("description", values.description ?? "");
        formData.set("isPublished", String(values.isPublished));
        formData.set("blobUrl", fileData.url);
        formData.set("blobPathname", fileData.pathname);
        formData.set("fileSizeBytes", String(fileData.size));

        if (publication) {
          await updatePublication(publication.id, formData);
        } else {
          await createPublication(formData);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save publication."
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
                <CardTitle>Publication Details</CardTitle>
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
                          placeholder="Newsletter - Spring 2026"
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
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1894}
                          max={2100}
                          aria-required="true"
                          {...field}
                          value={field.value as number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <p className="text-sm font-medium mb-2">
                    Publication PDF{" "}
                    <span className="text-destructive">*</span>
                  </p>
                  <PdfUpload
                    folder="publications"
                    label="Upload publication PDF"
                    accept=".pdf"
                    currentFile={
                      fileData
                        ? {
                            url: fileData.url,
                            name: publication?.title ?? "Uploaded file",
                            size: fileData.size,
                          }
                        : undefined
                    }
                    onUpload={(result) => setFileData(result)}
                    onRemove={() => setFileData(null)}
                  />
                </div>
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
                  name="isPublished"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Published</FormLabel>
                        <FormDescription>Show on public site</FormDescription>
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
                  ) : publication ? (
                    "Update Publication"
                  ) : (
                    "Create Publication"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
