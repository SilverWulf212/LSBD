"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFee, updateFee, deleteFee } from "@/actions/fees";
import { formatCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Fee } from "@/types";

const categories = [
  { key: "dentist", label: "Dentist" },
  { key: "hygienist", label: "Hygienist" },
  { key: "miscellaneous", label: "Miscellaneous" },
] as const;

interface EditingFee {
  id?: number;
  name: string;
  amount: string; // dollars as string for input
  description: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
}

export function FeesManager({ initialFees }: { initialFees: Fee[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fee | null>(null);
  const [editing, setEditing] = useState<EditingFee | null>(null);
  const [activeTab, setActiveTab] = useState("dentist");

  function openNew() {
    setEditing({
      name: "",
      amount: "",
      description: "",
      category: activeTab,
      sortOrder: 0,
      isActive: true,
    });
    setEditDialogOpen(true);
  }

  function openEdit(fee: Fee) {
    setEditing({
      id: fee.id,
      name: fee.name,
      amount: (fee.amount / 100).toFixed(2),
      description: fee.description ?? "",
      category: fee.category,
      sortOrder: fee.sortOrder,
      isActive: fee.isActive,
    });
    setEditDialogOpen(true);
  }

  function handleSave() {
    if (!editing) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", editing.name);
        // Convert dollars to cents
        const cents = Math.round(parseFloat(editing.amount || "0") * 100);
        formData.set("amount", String(cents));
        formData.set("description", editing.description);
        formData.set("category", editing.category);
        formData.set("sortOrder", String(editing.sortOrder));
        formData.set("isActive", String(editing.isActive));

        if (editing.id) {
          await updateFee(editing.id, formData);
          toast.success("Fee updated.");
        } else {
          await createFee(formData);
          toast.success("Fee created.");
        }
        setEditDialogOpen(false);
        setEditing(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save fee."
        );
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteFee(deleteTarget.id);
        toast.success("Fee deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete fee.");
      }
    });
  }

  function renderTable(category: string) {
    const filtered = initialFees.filter((f) => f.category === category);

    if (filtered.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No fees in this category yet.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Fee Name</TableHead>
              <TableHead scope="col" className="w-28 text-right">
                Amount
              </TableHead>
              <TableHead scope="col" className="w-20">
                Status
              </TableHead>
              <TableHead scope="col" className="w-16">
                Order
              </TableHead>
              <TableHead scope="col" className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((fee) => (
              <TableRow key={fee.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{fee.name}</p>
                    {fee.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fee.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCents(fee.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={fee.isActive ? "default" : "secondary"}>
                    {fee.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{fee.sortOrder}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(fee)}
                      aria-label={`Edit ${fee.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTarget(fee)}
                      aria-label={`Delete ${fee.name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            {categories.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Fee
          </Button>
        </div>

        {categories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            {renderTable(cat.key)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit Fee" : "New Fee"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="fee-name">Fee Name</Label>
                <Input
                  id="fee-name"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="License renewal"
                  aria-required="true"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-amount">Amount (dollars)</Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.amount}
                  onChange={(e) =>
                    setEditing({ ...editing, amount: e.target.value })
                  }
                  placeholder="100.00"
                  aria-required="true"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-description">Description (optional)</Label>
                <Input
                  id="fee-description"
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="Brief description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-category">Category</Label>
                <Select
                  value={editing.category}
                  onValueChange={(val) =>
                    setEditing({ ...editing, category: val })
                  }
                >
                  <SelectTrigger id="fee-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fee-sort">Sort Order</Label>
                  <Input
                    id="fee-sort"
                    type="number"
                    min="0"
                    value={editing.sortOrder}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sortOrder: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch
                    id="fee-active"
                    checked={editing.isActive}
                    onCheckedChange={(val) =>
                      setEditing({ ...editing, isActive: val })
                    }
                    aria-label="Fee active status"
                  />
                  <Label htmlFor="fee-active">Active</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : editing?.id ? (
                "Update Fee"
              ) : (
                "Create Fee"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        itemName={deleteTarget?.name ?? ""}
        isPending={isPending}
      />
    </>
  );
}
