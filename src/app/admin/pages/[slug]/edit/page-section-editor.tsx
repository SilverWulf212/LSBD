"use client";

import React, { useState, useTransition } from "react";
import { updatePageSection } from "@/actions/pages";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { PageSection } from "@/types";

interface PageSectionEditorProps {
  sections: PageSection[];
  pageSlug: string;
}

interface SectionState {
  title: string;
  content: string;
  dirty: boolean;
}

export function PageSectionEditor({
  sections,
  pageSlug,
}: PageSectionEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  const [sectionStates, setSectionStates] = useState<
    Record<number, SectionState>
  >(
    Object.fromEntries(
      sections.map((s) => [
        s.id,
        { title: s.title ?? "", content: s.content, dirty: false },
      ])
    )
  );

  function updateState(
    id: number,
    field: "title" | "content",
    value: string
  ) {
    setSectionStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  function handleSave(section: PageSection) {
    const state = sectionStates[section.id];
    if (!state) return;

    setSavingId(section.id);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("pageSlug", pageSlug);
        formData.set("sectionKey", section.sectionKey);
        formData.set("title", state.title);
        formData.set("content", state.content);

        await updatePageSection(section.id, formData);

        setSectionStates((prev) => ({
          ...prev,
          [section.id]: { ...prev[section.id], dirty: false },
        }));
        toast.success(`Section "${section.sectionKey}" saved.`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save section."
        );
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const state = sectionStates[section.id];
        if (!state) return null;

        return (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {section.sectionKey}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => handleSave(section)}
                  disabled={!state.dirty || isPending}
                >
                  {savingId === section.id ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      Saving...
                    </>
                  ) : state.dirty ? (
                    "Save Changes"
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Saved
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor={`title-${section.id}`}>Section Title</Label>
                <Input
                  id={`title-${section.id}`}
                  value={state.title}
                  onChange={(e) =>
                    updateState(section.id, "title", e.target.value)
                  }
                  placeholder="Section title (optional)"
                />
              </div>
              <div className="grid gap-2">
                <Label>Content</Label>
                <RichTextEditor
                  content={state.content}
                  onChange={(html) =>
                    updateState(section.id, "content", html)
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
