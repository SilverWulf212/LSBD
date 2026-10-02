import type * as React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { lastPage, pageHref, pageWindow, rangeText } from "@/lib/staff-query";

export type ServerTableColumn<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function ServerTable<T>({
  columns, rows, rowKey, total, page, pageSize, basePath, params, emptyText,
}: {
  columns: ServerTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
  emptyText: string;
}) {
  const last = lastPage(total, pageSize);
  const href = (p: number) => pageHref(basePath, params, p);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? emptyText : rangeText(page, pageSize, total, rows.length)}
      </p>
      {total > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((c) => (
                  <TableCell key={c.header} className={c.className}>{c.cell(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {last > 1 && (
        <Pagination className="print:hidden">
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={href(page - 1)} />
              </PaginationItem>
            )}
            {pageWindow(page, last).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink href={href(p)} isActive={p === page}>{p}</PaginationLink>
                </PaginationItem>
              ),
            )}
            {page < last && (
              <PaginationItem>
                <PaginationNext href={href(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
