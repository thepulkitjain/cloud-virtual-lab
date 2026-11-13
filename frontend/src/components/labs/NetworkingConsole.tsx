import React from 'react';
import { Network, Play, ShieldAlert } from 'lucide-react';

interface NetworkingConsoleProps {
  onRunCommand: (cmd: string) => void;
  disabled?: boolean;
}

export const NetworkingConsole: React.FC<NetworkingConsoleProps> = ({
  onRunCommand,
  disabled,
}) => {
  const tools = [
    { label: 'Ping Localhost', cmd: 'ping 127.0.0.1' },
    { label: 'Ping Remote Host', cmd: 'ping 10.0.15.42' },
    { label: 'View Network Interfaces', cmd: 'ifconfig' },
    { label: 'DNS Name Lookup', cmd: 'nslookup virtuallab.edu' },
    { label: 'Trace Network Route', cmd: 'traceroute 10.0.15.42' },
    { label: 'Active Ports & Sockets', cmd: 'netstat' },
    { label: 'HTTP GET Request', cmd: 'curl http://virtuallab.edu' },
    { label: 'HTTP Header Probe', cmd: 'curl -I http://virtuallab.edu' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-white flex items-center gap-2">
          <Network className="w-4 h-4 text-emerald-400" />
          Network Diagnostics &amp; Utility Presets
        </h4>
        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded-full">
          Simulated Network Node
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map((t, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onRunCommand(t.cmd)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white transition cursor-pointer font-mono text-[11px] disabled:opacity-50"
          >
            <Play className="w-3 h-3 text-emerald-400" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-[11px] text-emerald-300 flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Simulates ICMP echo requests, routing tables, and DNS queries in a safe environment without actual raw socket or network interface privileges.
        </p>
      </div>
    </div>
  );
};

export default NetworkingConsole;
