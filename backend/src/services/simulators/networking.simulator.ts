export class NetworkingSimulator {
  static execute(commandStr: string): string {
    const trimmed = commandStr.trim();
    if (!trimmed) return '';

    const args = trimmed.split(/\s+/);
    const command = args[0].toLowerCase();

    switch (command) {
      case 'ping': {
        const host = args.filter((a) => !a.startsWith('-'))[1] || '127.0.0.1';
        const count = 4;
        const ip = host === 'localhost' || host === '127.0.0.1' ? '127.0.0.1' : '10.0.15.42';

        const lines: string[] = [
          `PING ${host} (${ip}) 56(84) bytes of data.`,
          `64 bytes from ${ip}: icmp_seq=1 ttl=64 time=0.038 ms`,
          `64 bytes from ${ip}: icmp_seq=2 ttl=64 time=0.041 ms`,
          `64 bytes from ${ip}: icmp_seq=3 ttl=64 time=0.039 ms`,
          `64 bytes from ${ip}: icmp_seq=4 ttl=64 time=0.044 ms`,
          '',
          `--- ${host} ping statistics ---`,
          `${count} packets transmitted, ${count} received, 0% packet loss, time 3004ms`,
          'rtt min/avg/max/mdev = 0.038/0.040/0.044/0.002 ms',
        ];
        return lines.join('\n');
      }

      case 'ifconfig':
      case 'ipconfig':
      case 'ip': {
        return [
          'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
          '        inet 192.168.1.105  netmask 255.255.255.0  broadcast 192.168.1.255',
          '        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>',
          '        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)',
          '        RX packets 145028  bytes 18239014 (18.2 MB)',
          '        TX packets 102492  bytes 14209148 (14.2 MB)',
          '',
          'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
          '        inet 127.0.0.1  netmask 255.0.0.0',
          '        inet6 ::1  prefixlen 128  scopeid 0x10<host>',
          '        loop  txqueuelen 1000  (Local Loopback)',
        ].join('\n');
      }

      case 'nslookup': {
        const domain = args[1] || 'virtuallab.edu';
        return [
          'Server:         10.0.0.1',
          'Address:        10.0.0.1#53',
          '',
          'Non-authoritative answer:',
          `Name:   ${domain}`,
          'Address: 10.0.15.42',
          'Address: 2606:4700:4700::1111',
        ].join('\n');
      }

      case 'traceroute':
      case 'tracert': {
        const target = args[1] || 'gateway.virtuallab.edu';
        return [
          `traceroute to ${target} (10.0.15.42), 30 hops max, 60 byte packets`,
          ' 1  _gateway (192.168.1.1)  0.342 ms  0.311 ms  0.289 ms',
          ' 2  10.240.0.1 (10.240.0.1)  1.218 ms  1.192 ms  1.170 ms',
          ' 3  cloud-edge-gw.edu (10.100.1.254)  3.450 ms  3.412 ms  3.389 ms',
          ` 4  ${target} (10.0.15.42)  4.112 ms  4.089 ms  4.065 ms`,
        ].join('\n');
      }

      case 'netstat': {
        return [
          'Active Internet connections (only servers)',
          'Proto Recv-Q Send-Q Local Address           Foreign Address         State',
          'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN',
          'tcp        0      0 127.0.0.1:5432          0.0.0.0:*               LISTEN',
          'tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN',
          'tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN',
        ].join('\n');
      }

      case 'curl': {
        const url = args.find((a) => a.startsWith('http://') || a.startsWith('https://')) || 'http://virtuallab.edu';
        const isHeaderOnly = args.includes('-I') || args.includes('-i');

        if (isHeaderOnly) {
          return [
            'HTTP/1.1 200 OK',
            'Date: Thu, 05 Nov 2026 12:00:00 GMT',
            'Server: CloudVirtualLab/1.0',
            'Content-Type: application/json; charset=utf-8',
            'Content-Length: 64',
            'Connection: keep-alive',
          ].join('\n');
        }

        return JSON.stringify(
          {
            status: 'success',
            service: 'Cloud Virtual Lab Educational Gateway',
            environment: 'Simulated Network Node',
            protocol: 'HTTP/1.1',
          },
          null,
          2
        );
      }

      case 'help': {
        return [
          'Virtual Lab Networking Diagnostic Commands:',
          '  ping <host>        Test reachability and round-trip latency to a network host',
          '  ifconfig           Display network interface configuration and IP addresses',
          '  nslookup <domain>  Query DNS name servers for domain records',
          '  traceroute <host>  Trace network packet routing hops to destination',
          '  netstat            Display active network connections and listening ports',
          '  curl [-I] <url>    Perform an HTTP client request',
          '  help               Display this help manual',
        ].join('\n');
      }

      default: {
        return `net-sim: '${command}' is not a recognized networking command. Type 'help' to see available tools.`;
      }
    }
  }
}
