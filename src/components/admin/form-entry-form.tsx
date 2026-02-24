"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formEntrySchema } from "@/lib/validators";
import { FORM_CATEGORIES } from "@/lib/constants";
import { createForm, updateForm } from "@/actions/forms";
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
import type { DownloadableForm } from "@/types";
import type { z } from "zod";

type FormEntryFormValues = z.infer<typeof formEntrySchema>;

interface FormEntryFormProps {
  formEntry?: DownloadableForm | null;
}

export function FormEntryForm({ formEntry }: FormEntryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [fileData, setFileData] = useState<{
    url: string;
    pathname: string;
    size: number;
  } | null>(
    formEntry?.blobUrl
      ? {
          url: formEntry.blobUrl,
          pathname: formEntry.blobPathname ?? "",
          size: formEntry.fileSizeBytes ?? 0,
        }
      : null
  );

  const form = useForm<FormEntryFormValues>({
    resolver: zodResolver(formEntrySchema),
    defaultValues: {
      name: formEntry?.name ?? "",
      description: formEntry?.description ?? "",
      category: formEntry?.category ?? "",
      isExternal: formEntry?.isExternal ?? false,
      externalUrl: formEntry?.externalUrl ?? "",
      sortOrder: formEntry?.sortOrder ?? 0,
      isActive: formEntry?.isActive ?? true,
    },
  });

  const watchIsExternal = form.watch("isExternal");

  function onSubmit(values: FormEntryFormValues) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", values.name);
        formData.set("description", values.description ?? "");
        formData.set("category", values.category);
        formData.set("isExternal", String(values.isExternal));
        formData.set("externalUrl", values.externalUrl ?? "");
        formData.set("sortOrder", String(values.sortOrder));
        formData.set("isActive", String(values.isActive));

        if (fileData) {
          formData.set("blobUrl", fileData.url);
          formData.set("blobPathname", fileData.pathname);
          formData.set("fileSizeBytes", String(fileData.size));
        }

        if (formEntry) {
          await updateForm(formEntry.id, formData);
        } else {
          await createForm(formData);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save form."
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
                <CardTitle>Form Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Application for..."
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this form"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FORM_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.key} value={cat.key}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isExternal"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>External Link</FormLabel>
                        <FormDescription>
                          Link to an external URL instead of an uploaded file
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="Toggle external link"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchIsExternal ? (
                  <FormField
                    control={form.control}
                    name="externalUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://example.com/form"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-2">Form File (PDF)</p>
                    <PdfUpload
                      folder="forms"
                      label="Upload form PDF"
                      accept=".pdf"
                      currentFile={
                        fileData
                          ? {
                              url: fileData.url,
                              name: formEntry?.name ?? "Uploaded file",
                              size: fileData.size,
                            }
                          : undefined
                      }
                      onUpload={(result) => setFileData(result)}
                      onRemove={() => setFileData(null)}
                    />
                  </div>
                )}
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
                        <FormDescription>Show on public site</FormDescription>
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
                        <Input type="number" min={0} {...field} />
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
                  ) : formEntry ? (
                    "Update Form"
                  ) : (
                    "Create Form"
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
