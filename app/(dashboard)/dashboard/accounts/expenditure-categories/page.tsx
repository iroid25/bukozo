"use client";

import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Settings, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { CategoryKind } from "@prisma/client";

export default function ExpenditureCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    parentId: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Helper to build hierarchical categories
  const buildCategoryHierarchy = (flatCategories: any[]) => {
    const categoriesMap = new Map();
    const topLevelCategories: any[] = [];

    // First pass: populate map and initialize children array
    flatCategories.forEach(cat => {
      categoriesMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: assign children to their parents
    flatCategories.forEach(cat => {
      if (cat.parentId) {
        const parent = categoriesMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoriesMap.get(cat.id));
        }
      } else {
        topLevelCategories.push(categoriesMap.get(cat.id));
      }
    });

    return topLevelCategories;
  };

  async function loadCategories() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/budget-categories?kind=${CategoryKind.EXPENSE}`);
      const json = await res.json();
      if (json.success) {
        const hierarchicalCategories = buildCategoryHierarchy(json.data || []);
        setCategories(hierarchicalCategories);
      } else {
        toast.error(json.error || "Failed to load categories");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while loading categories");
    } finally {
      setLoading(false);
    }
  }

  const filterHierarchy = (items: any[], term: string) => {
    if (!term) return items;
    const lowerCaseTerm = term.toLowerCase();
    return items.filter(item => {
      const matchesSelf = item.name.toLowerCase().includes(lowerCaseTerm) ||
                          item.code?.toLowerCase().includes(lowerCaseTerm);
      const matchesChild = item.children?.some((child: any) => 
        child.name.toLowerCase().includes(lowerCaseTerm) ||
        child.code?.toLowerCase().includes(lowerCaseTerm)
      );
      return matchesSelf || matchesChild;
    });
  };

  const filteredCategories = filterHierarchy(categories, searchTerm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let res, json;
      if (isEditing && selectedCategory) {
        res = await fetch(`/api/v1/budget-categories/${selectedCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            code: formData.code,
            description: formData.description,
            parentId: formData.parentId || null,
          }),
        });
        json = await res.json();
      } else {
        res = await fetch("/api/v1/budget-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            code: formData.code,
            kind: CategoryKind.EXPENSE,
            description: formData.description,
            parentId: formData.parentId || null,
          }),
        });
        json = await res.json();
      }

      if (json.success) {
        toast.success(`Category ${isEditing ? 'updated' : 'created'} successfully`);
        setIsDialogOpen(false);
        resetForm();
        loadCategories();
      } else {
        toast.error(json.error || "Operation failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    }
  }

  function resetForm() {
    setFormData({ name: "", code: "", description: "", parentId: "" });
    setIsEditing(false);
    setSelectedCategory(null);
  }

  function handleEdit(category: any) {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      code: category.code || "",
      description: category.description || "",
      parentId: category.parentId || "",
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  }

  async function handleToggleStatus(category: any) {
    try {
      const res = await fetch(`/api/v1/budget-categories/${category.id}/toggle`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(`Category ${category.isActive ? 'deactivated' : 'activated'} successfully`);
        loadCategories();
      } else {
        toast.error(json.error || "Failed to update status");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  async function handleDelete(category: any) {
    if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/budget-categories/${category.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Category deleted successfully");
        loadCategories();
      } else {
        toast.error(json.error || "Failed to delete category");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenditure Categories</h1>
          <p className="text-muted-foreground">Manage expense classifications for budgeting and tracking.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="md:w-auto w-full">
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Category" : "Create New Category"}</DialogTitle>
              <DialogDescription>
                Expenses will be grouped under this category for reporting.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name <span className="text-red-500">*</span></Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Office Supplies, Staff Salaries" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Category Code (Optional)</Label>
                <Input 
                  id="code" 
                  placeholder="e.g. EXP-001" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentId">Parent Category (Optional)</Label>
                <select 
                  id="parentId"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.parentId}
                  onChange={e => setFormData({...formData, parentId: e.target.value})}
                >
                  <option value="">None (Top Level Category)</option>
                  {categories.filter(c => !c.parentId && c.id !== selectedCategory?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">Select a parent if this is a sub-item (e.g. "Water Bill" under "Utilities")</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input 
                  id="description" 
                  placeholder="Enter a brief description" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{isEditing ? "Save Changes" : "Create Category"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Category Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linked to COA</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading categories...
                </TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FolderOpen className="h-8 w-8 text-muted-foreground opacity-20" />
                    <p className="text-muted-foreground font-medium">No results found</p>
                    <p className="text-xs text-muted-foreground">Try adjusting your search or create a new category.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <React.Fragment key={category.id}>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {category.code || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{category.name}</span>
                        {category.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {category.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.isActive ? "default" : "secondary"} className={category.isActive ? "bg-green-100 text-green-800 border-green-200" : ""}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                         Auto-Synced
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                         <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                            <Edit className="h-4 w-4 text-blue-600" />
                         </Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleToggleStatus(category)}>
                                {category.isActive ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4 text-orange-600" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4 text-green-600" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(category)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {category.children?.map((child: any) => (
                    <TableRow key={child.id} className="border-l-4 border-l-blue-500/30">
                      <TableCell className="font-mono text-xs text-muted-foreground pl-8">
                        {child.code || "-"}
                      </TableCell>
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-900">{child.name}</span>
                            {child.description && (
                              <span className="text-[10px] text-muted-foreground">
                                {child.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={child.isActive ? "outline" : "secondary"} className="text-[10px]">
                          {child.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] text-muted-foreground italic">Sub-Category</span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(child)}>
                            <Edit className="h-3 w-3 text-blue-600" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold">Sync to Chart of Accounts</p>
          <p>Every expense category created here is automatically synced to the Chart of Accounts (COA) for financial transparency and accurate ledger reporting. Do not manually create ledger entries for these in the COA module.</p>
        </div>
      </div>
    </div>
  );
}
