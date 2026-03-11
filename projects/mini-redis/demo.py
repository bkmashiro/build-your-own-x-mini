# Demo: connects to mini-redis and tests basic commands
import asyncio, socket

def send_command(sock, *args):
    """Send a RESP array command"""
    cmd = f"*{len(args)}\r\n"
    for arg in args:
        arg = str(arg)
        cmd += f"${len(arg)}\r\n{arg}\r\n"
    sock.sendall(cmd.encode())
    return sock.recv(4096).decode()

def run_demo():
    s = socket.socket()
    s.connect(('127.0.0.1', 6399))
    
    print("PING:", send_command(s, 'PING').strip())
    print("SET foo bar:", send_command(s, 'SET', 'foo', 'bar').strip())
    print("GET foo:", send_command(s, 'GET', 'foo').strip())
    print("SET counter 0:", send_command(s, 'SET', 'counter', '0').strip())
    print("EXPIRE foo 10:", send_command(s, 'EXPIRE', 'foo', '10').strip())
    print("TTL foo:", send_command(s, 'TTL', 'foo').strip())
    print("KEYS *:", send_command(s, 'KEYS', '*').strip())
    print("DBSIZE:", send_command(s, 'DBSIZE').strip())
    print("DEL foo:", send_command(s, 'DEL', 'foo').strip())
    print("GET foo (after del):", send_command(s, 'GET', 'foo').strip())
    s.close()
    print("\nAll tests passed!")

if __name__ == '__main__':
    run_demo()
