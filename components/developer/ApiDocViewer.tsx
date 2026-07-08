"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiEndpoint {
  method: ApiMethod;
  path: string;
  summary: string;
  description?: string;
  params?: ApiParam[];
  body?: Record<string, any>;
  response: Record<string, any>;
}

export interface ApiCategory {
  name: string;
  description: string;
  endpoints: ApiEndpoint[];
}

interface ApiDocViewerProps {
  categories: ApiCategory[];
}

export default function ApiDocViewer({ categories }: ApiDocViewerProps) {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.name || "");

  const scrollToCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    const element = document.getElementById(`category-${categoryName}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 shrink-0 lg:border-r pr-4 overflow-y-auto h-full space-y-2">
        <h3 className="font-semibold text-lg mb-4 px-2">API Reference</h3>
        {categories.map((category) => (
          <div key={category.name} className="space-y-1">
            <button
              onClick={() => scrollToCategory(category.name)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                activeCategory === category.name
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {category.name}
            </button>
            {activeCategory === category.name && (
              <div className="ml-4 space-y-1 border-l pl-2">
                {category.endpoints.map((endpoint, idx) => (
                  <a
                    key={idx}
                    href={`#endpoint-${category.name}-${idx}`}
                    className="block text-xs text-muted-foreground hover:text-foreground py-1 truncate"
                  >
                    <span className={cn(
                        "uppercase mr-1 font-bold",
                        getMethodColor(endpoint.method)
                    )}>
                        {endpoint.method}
                    </span>
                    {endpoint.path}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-12 pb-20">
        {categories.map((category) => (
          <div key={category.name} id={`category-${category.name}`} className="space-y-6">
             <div className="border-b pb-2">
                <h2 className="text-3xl font-bold tracking-tight">{category.name}</h2>
                <p className="text-muted-foreground mt-1">{category.description}</p>
             </div>

             <div className="space-y-8">
                {category.endpoints.map((endpoint, idx) => (
                  <EndpointCard 
                    key={idx} 
                    endpoint={endpoint} 
                    id={`endpoint-${category.name}-${idx}`} 
                  />
                ))}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EndpointCard({ endpoint, id }: { endpoint: ApiEndpoint; id: string }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card id={id} className="overflow-hidden border-l-4" style={{ borderLeftColor: getMethodColorHex(endpoint.method) }}>
      <CardHeader className="bg-muted/30 py-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
                <Badge className={cn("uppercase rounded-sm px-2 py-1", getMethodColorBg(endpoint.method))}>
                    {endpoint.method}
                </Badge>
                <code className="text-sm font-semibold font-mono bg-muted/50 px-2 py-1 rounded">
                    {endpoint.path}
                </code>
                <span className="text-sm text-muted-foreground truncate hidden sm:inline-block">
                    - {endpoint.summary}
                </span>
            </div>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-4 space-y-6">
            <div>
                <p className="text-sm text-gray-600">{endpoint.description || endpoint.summary}</p>
            </div>

            {/* Parameters */}
            {endpoint.params && endpoint.params.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 tracking-wider">Parameters</h4>
                    <div className="border rounded-md divide-y">
                        {endpoint.params.map((param, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 text-sm">
                                <div className="w-40 shrink-0 font-mono font-medium text-blue-600">
                                    {param.name}
                                    {param.required && <span className="text-red-500 ml-1">*</span>}
                                </div>
                                <div className="w-24 shrink-0 text-muted-foreground text-xs">{param.type}</div>
                                <div className="flex-1 text-gray-600">{param.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Request Body */}
            {endpoint.body && (
                 <CodeBlock title="Request Body" code={endpoint.body} />
            )}

            {/* Response */}
            <CodeBlock title="Response" code={endpoint.response} />
        </CardContent>
      )}
    </Card>
  );
}

function CodeBlock({ title, code }: { title: string; code: any }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(code, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{title}</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
            </div>
            <div className="bg-slate-950 text-slate-50 rounded-md p-4 overflow-x-auto">
                <pre className="text-xs font-mono">
                    {JSON.stringify(code, null, 2)}
                </pre>
            </div>
        </div>
    );
}

function getMethodColor(method: ApiMethod) {
    switch (method) {
        case "GET": return "text-blue-600";
        case "POST": return "text-green-600";
        case "PUT": return "text-orange-600";
        case "PATCH": return "text-yellow-600";
        case "DELETE": return "text-red-600";
        default: return "text-gray-600";
    }
}

function getMethodColorBg(method: ApiMethod) {
    switch (method) {
        case "GET": return "bg-blue-100 text-blue-700 hover:bg-blue-100";
        case "POST": return "bg-green-100 text-green-700 hover:bg-green-100";
        case "PUT": return "bg-orange-100 text-orange-700 hover:bg-orange-100";
        case "PATCH": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
        case "DELETE": return "bg-red-100 text-red-700 hover:bg-red-100";
        default: return "bg-gray-100 text-gray-700 hover:bg-gray-100";
    }
}

function getMethodColorHex(method: ApiMethod) {
    switch (method) {
        case "GET": return "#2563eb";
        case "POST": return "#16a34a";
        case "PUT": return "#ea580c";
        case "PATCH": return "#ca8a04";
        case "DELETE": return "#dc2626";
        default: return "#4b5563";
    }
}
