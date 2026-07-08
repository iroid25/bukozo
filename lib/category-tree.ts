export type TreeLikeNode<T> = T & {
  children: TreeLikeNode<T>[];
};

export type TreeNodeInput = {
  id: string;
  parentId?: string | null;
};

export function buildTree<T extends TreeNodeInput>(items: T[]): TreeLikeNode<T>[] {
  const nodeMap = new Map<string, TreeLikeNode<T>>();

  items.forEach((item) => {
    nodeMap.set(item.id, { ...item, children: [] });
  });

  const roots: TreeLikeNode<T>[] = [];

  items.forEach((item) => {
    const node = nodeMap.get(item.id)!;
    if (item.parentId && nodeMap.has(item.parentId)) {
      nodeMap.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function sortTreeByCodeOrName<T extends { code?: string | null; name: string }>(
  nodes: TreeLikeNode<T>[],
) : TreeLikeNode<T>[] {
  const sortNodes = (items: TreeLikeNode<T>[]): TreeLikeNode<T>[] =>
    [...items]
      .sort((a, b) => {
        const aCode = a.code || "";
        const bCode = b.code || "";
        if (aCode && bCode) return aCode.localeCompare(bCode);
        if (aCode) return -1;
        if (bCode) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children || []),
      }));

  return sortNodes(nodes);
}
