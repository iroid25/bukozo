import { readFile } from "fs/promises";
import path from "path";
import { 
  BookOpen, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  FileText, 
  Settings, 
  ExternalLink,
  Code,
  LayoutDashboard,
  Wallet,
  HandCoins,
  History,
  Lock,
  Smartphone
} from "lucide-react";
import Link from "next/link";

interface Section {
  title: string;
  description: string;
  links: { label: string; url: string; isSource: boolean }[];
  content: string;
  icon: any;
}

export default async function HelpPage() {
  const filePath = path.join(process.cwd(), "progress", "detailed-functionalities-of-system.md");
  let content = "";
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p className="text-gray-600">Could not read the system functionality guide.</p>
      </div>
    );
  }

  // Basic parsing of the markdown file
  const sections: Section[] = [];
  const rawSections = content.split("## ").slice(1);

  const getIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("user")) return Users;
    if (t.includes("account")) return Wallet;
    if (t.includes("transaction") || t.includes("deposit")) return CreditCard;
    if (t.includes("loan")) return HandCoins;
    if (t.includes("float")) return History;
    if (t.includes("reserve") || t.includes("vault")) return Lock;
    if (t.includes("hold")) return ShieldCheck;
    if (t.includes("report")) return FileText;
    if (t.includes("mobile")) return Smartphone;
    if (t.includes("audit") || t.includes("setting")) return Settings;
    return BookOpen;
  };

  rawSections.forEach((raw) => {
    const lines = raw.split("\n");
    const title = lines[0].split(" (")[0].trim();
    
    // Extract description (usually first couple of lines after title)
    const descriptionLine = lines.find(l => l.startsWith("**Description:**"));
    const description = descriptionLine ? descriptionLine.replace("**Description:**", "").trim() : "";

    // Extract links
    const links: { label: string; url: string; isSource: boolean }[] = [];
    lines.forEach(line => {
      const match = line.match(/\[(.*?)\]\((.*?)\)/g);
      if (match) {
        match.forEach(m => {
          const innerMatch = m.match(/\[(.*?)\]\((.*?)\)/);
          if (innerMatch) {
            links.push({
              label: innerMatch[1],
              url: innerMatch[2],
              isSource: innerMatch[2].startsWith("file://")
            });
          }
        });
      }
    });

    sections.push({
      title,
      description,
      links,
      content: raw,
      icon: getIcon(title)
    });
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                System Functionality Guide
              </h1>
              <p className="text-slate-500 mt-1 text-lg">
                Your total navigation and operation companion for BUTSACCO
              </p>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div 
                key={idx}
                className="group relative bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute -right-4 -top-4 h-24 w-24 bg-slate-50 rounded-full group-hover:bg-blue-50 transition-colors duration-300" />
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-slate-300 font-mono text-sm group-hover:text-blue-200 transition-colors">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-slate-800 mb-2 truncate">
                    {section.title}
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2">
                    {section.description || "Discover the tools and workflows for managed " + section.title.toLowerCase() + "."}
                  </p>

                  <div className="space-y-4">
                    {/* Live Links */}
                    <div className="flex flex-wrap gap-2">
                      {section.links.filter(l => !l.isSource).map((link, lidx) => (
                        <Link
                          key={lidx}
                          href={link.url}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {link.label.replace("Live: ", "")}
                        </Link>
                      ))}
                    </div>

                    {/* Source Links */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold w-full mb-1">Source Code</span>
                      {section.links.filter(l => l.isSource).map((link, lidx) => (
                        <div
                          key={lidx}
                          title={link.url}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 cursor-default opacity-70"
                        >
                          <Code className="h-3 w-3" />
                          {link.label.replace(" Page", "").replace(" Management", "")}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="mt-12 p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] text-white overflow-hidden relative">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">Need deeper assistance?</h3>
              <p className="text-slate-300">
                Contact the system administrator or refer to the technical audit logs for detailed transaction tracing and system health reports.
              </p>
            </div>
            <Link 
              href="/dashboard/settings/audit-log"
              className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all shadow-xl"
            >
              View Audit Logs
            </Link>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] -ml-32 -mb-32" />
        </div>
      </div>
    </div>
  );
}
