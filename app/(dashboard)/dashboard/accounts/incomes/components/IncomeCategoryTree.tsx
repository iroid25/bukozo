"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildTree,
  sortTreeByCodeOrName,
  type TreeLikeNode,
} from "@/lib/category-tree";
import type { SimpleBudgetCategory } from "@/types/incomes";
import { cn } from "@/lib/utils";

type IncomeTreeItem = {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
};

type CategoryBreakdownItem = {
  categoryId: string;
  categoryName: string;
  parentName?: string;
  count: number;
  amount: number;
};

type IncomeCategoryNode = TreeLikeNode<IncomeTreeItem>;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function CategoryRow({
  node,
  depth,
  expandedNodes,
  onToggle,
  statsById,
  aggregateById,
}: {
  node: IncomeCategoryNode;
  depth: number;
  expandedNodes: Record<string, boolean>;
  onToggle: (id: string) => void;
  statsById: Map<string, CategoryBreakdownItem>;
  aggregateById: Map<string, { count: number; amount: number }>;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedNodes[node.id] ?? true;
  const directStats = statsById.get(node.id);
  const aggregateStats = aggregateById.get(node.id) ?? { count: 0, amount: 0 };
  const count = directStats?.count ?? aggregateStats.count;
  const amount = directStats?.amount ?? aggregateStats.amount;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/70",
        depth > 0 && "ml-6",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onToggle(node.id)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="h-7 w-7 shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium">{node.name}</div>
            {node.code && (
              <div className="text-xs text-muted-foreground">{node.code}</div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary">
            {hasChildren ? `${node.children.length} items` : "Leaf"}
          </Badge>
          <Badge variant="outline">{count > 0 ? `${count} tx` : "No tx"}</Badge>
          <Badge variant="outline" className="font-mono">
            {formatCurrency(amount)}
          </Badge>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="border-t px-2 py-2 space-y-2">
          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              statsById={statsById}
              aggregateById={aggregateById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncomeCategoryTree({
  categories,
  breakdown = [],
}: {
  categories: SimpleBudgetCategory[];
  breakdown?: CategoryBreakdownItem[];
}) {
  const tree = useMemo(() => {
    const items: IncomeTreeItem[] = categories.map((category) => ({
      id: category.id,
      name: category.name,
      code: category.code ?? null,
      parentId: category.parentId ?? null,
    }));
    const roots = buildTree(items);
    return sortTreeByCodeOrName(roots);
  }, [categories]);

  const statsById = useMemo(() => {
    return new Map(breakdown.map((item) => [item.categoryId, item]));
  }, [breakdown]);

  const aggregateById = useMemo(() => {
    const aggregate = new Map<string, { count: number; amount: number }>();

    const walk = (node: IncomeCategoryNode): { count: number; amount: number } => {
      const direct = statsById.get(node.id);
      let count = direct?.count ?? 0;
      let amount = direct?.amount ?? 0;

      for (const child of node.children) {
        const childTotals = walk(child);
        count += childTotals.count;
        amount += childTotals.amount;
      }

      aggregate.set(node.id, { count, amount });
      return { count, amount };
    };

    tree.forEach((node) => {
      walk(node);
    });

    return aggregate;
  }, [statsById, tree]);

  const initialExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {};
    const walk = (items: IncomeCategoryNode[]) => {
      items.forEach((item) => {
        if (item.children.length > 0) {
          expanded[item.id] = true;
          walk(item.children);
        }
      });
    };
    walk(tree);
    return expanded;
  }, [tree]);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    initialExpanded,
  );

  useEffect(() => {
    setExpandedNodes(initialExpanded);
  }, [initialExpanded]);

  const onToggle = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (tree.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Income Visualise</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tree.map((node) => (
          <CategoryRow
            key={node.id}
            node={node}
            depth={0}
            expandedNodes={expandedNodes}
            onToggle={onToggle}
            statsById={statsById}
            aggregateById={aggregateById}
          />
        ))}
      </CardContent>
    </Card>
  );
}
