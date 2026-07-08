"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { StatementsDataTable } from "./statements-data-table";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export default function MemberStatementsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  function fetchStatements() {
    fetch(`/api/v1/statements?memberId=${id}`)
      .then((r) => r.json())
      .then((json) => {
        setStatements(json.data || []);
        setLoading(false);
      });
  }

  useEffect(() => { fetchStatements(); }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);

    try {
      const res = await fetch("/api/v1/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: id,
          subjectType: "MEMBER",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to generate statement");
      } else {
        toast.success("Statement generated successfully");
        fetchStatements();
      }
    } catch {
      toast.error("Failed to generate statement");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Member Statements</CardTitle>
          <Button onClick={handleGenerate} disabled={generating}>
            <FileText className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Generate New Statement"}
          </Button>
        </CardHeader>
        <CardContent><StatementsDataTable data={statements} /></CardContent>
      </Card>
    </div>
  );
}
