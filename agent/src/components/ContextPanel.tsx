import { FileCode, FileText, TerminalWindow, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ChatAgentContext } from "../types";

interface ContextPanelProps {
  files: ChatAgentContext[];
  onClearContext?: () => void;
}

export function ContextPanel({ files, onClearContext }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Auto-select first file if none selected or if active one is removed
  useEffect(() => {
    if (files.length > 0) {
      if (!activeTab || !files.find((f) => f.id === activeTab)) {
        setActiveTab(files[0].id);
      }
    } else {
      setActiveTab(null);
    }
  }, [files, activeTab]);

  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-500 p-4 border-l border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        <FileText size={48} className="opacity-20 mb-4" />
        <p className="text-sm font-medium">No active context</p>
        <p className="text-xs text-center mt-2 max-w-[200px]">
          Files read or edited by the agent will appear here.
        </p>
      </div>
    );
  }

  const activeFile = files.find((f) => f.id === activeTab);

  return (
    <div className="h-full flex flex-col border-l border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
        <div className="flex items-center overflow-x-auto no-scrollbar flex-1">
          {files.map((file) => (
            <button
              type="button"
              key={file.id}
              onClick={() => setActiveTab(file.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-r border-neutral-300 dark:border-neutral-800 transition-colors cursor-pointer
                ${
                  activeTab === file.id
                    ? "bg-white dark:bg-neutral-950 text-foreground border-b-2 border-b-[#F48120]" // Using Cloudflare orange for active tab
                    : "bg-transparent text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800"
                }
              `}
            >
              {file.type === "terminal" ? (
                <TerminalWindow size={16} />
              ) : (
                <FileCode size={16} />
              )}
              <span className="truncate max-w-[200px]">{file.title}</span>
            </button>
          ))}
        </div>
        {onClearContext && (
          <button
            type="button"
            onClick={onClearContext}
            className="p-3 text-muted-foreground hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors border-l border-neutral-300 dark:border-neutral-800"
            title="Clear Context"
          >
            <Trash size={16} />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto relative bg-[#1e1e1e] h-full"> 
        {activeFile ? (
          <SyntaxHighlighter
            language={activeFile.type === 'terminal' ? 'bash' : 'typescript'} // Default to typescript for now, can be improved
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "1.5rem",
              fontSize: "0.875rem",
              lineHeight: "1.5",
              background: "transparent",
              height: "100%",
            }}
            showLineNumbers={true}
            wrapLines={true}
          >
            {activeFile.content}
          </SyntaxHighlighter>
        ) : (
             <div className="flex items-center justify-center h-full text-neutral-500">
                Select a file to view
             </div>
        )}
      </div>
    </div>
  );
}
