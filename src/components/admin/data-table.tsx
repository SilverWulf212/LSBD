"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T) => React.ReactNode;
  accessorFn?: (item: T) => string | number | boolean | null | undefined;
}

export interface RowAction<T> {
  label: string;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  actions?: RowAction<T>[];
  searchPlaceholder?: string;
  searchKey?: string;
  pageSize?: number;
  caption?: string;
  emptyMessage?: string;
  getRowId: (item: T) => string | number;
}

type SortDirection = "asc" | "desc" | null;

export function DataTable<T>({
  data,
  columns,
  actions,
  searchPlaceholder = "Search...",
  searchKey,
  pageSize = 10,
  caption,
  emptyMessage = "No data found.",
  getRowId,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    if (!search || !searchKey) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter((item) => {
      const col = columns.find((c) => c.key === searchKey);
      const value = col?.accessorFn
        ? col.accessorFn(item)
        : (item as Record<string, unknown>)[searchKey];
      return String(value ?? "")
        .toLowerCase()
        .includes(lowerSearch);
    });
  }, [data, search, searchKey, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDirection) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const aVal = col?.accessorFn
        ? col.accessorFn(a)
        : (a as Record<string, unknown>)[sortKey];
      const bVal = col?.accessorFn
        ? col.accessorFn(b)
        : (b as Record<string, unknown>)[sortKey];
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDirection, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  }

  function SortIcon({ columnKey }: { columnKey: string }) {
    if (sortKey !== columnKey)
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    if (sortDirection === "asc")
      return <ArrowUp className="ml-1 inline h-3 w-3" />;
    return <ArrowDown className="ml-1 inline h-3 w-3" />;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchKey && (
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          {caption && <TableCaption>{caption}</TableCaption>}
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} scope="col" className={col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm px-1 -mx-1"
                      aria-label={`Sort by ${col.header}`}
                    >
                      {col.header}
                      <SortIcon columnKey={col.key} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {actions && actions.length > 0 && (
                <TableHead scope="col" className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((item) => (
                <TableRow key={getRowId(item)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(item)
                        : String(
                            (item as Record<string, unknown>)[col.key] ?? ""
                          )}
                    </TableCell>
                  ))}
                  {actions && actions.length > 0 && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Actions for row ${getRowId(item)}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action) => (
                            <DropdownMenuItem
                              key={action.label}
                              onClick={() => action.onClick(item)}
                              variant={
                                action.variant === "destructive"
                                  ? "destructive"
                                  : "default"
                              }
                              className="cursor-pointer"
                            >
                              {action.icon && (
                                <span className="mr-2" aria-hidden="true">
                                  {action.icon}
                                </span>
                              )}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
