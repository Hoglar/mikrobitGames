"""PostgreSQL test proxy: lose COMMIT acknowledgement after a record insert.

Only used on the harness-owned cluster with sslmode=disable. It never parses
or logs passwords. Other server messages pass through byte-for-byte.
"""
import select
import socket
import struct
import threading


class CommitFaultProxy:
    def __init__(self,target_port):
        self.target_port=target_port
        self.listener=socket.socket()
        self.listener.bind(('127.0.0.1',0));self.listener.listen()
        self.listener.settimeout(.2)
        self.port=self.listener.getsockname()[1]
        self.stop=threading.Event();self.arm=threading.Event();self.triggered=threading.Event()
        self.sockets=set();self.lock=threading.Lock()
        self.thread=threading.Thread(target=self.accept,daemon=True);self.thread.start()

    def accept(self):
        while not self.stop.is_set():
            try:client,_=self.listener.accept()
            except socket.timeout:continue
            except OSError:return
            threading.Thread(target=self.pipe,args=(client,),daemon=True).start()

    def pipe(self,client):
        server=None;buffer=b'';insert_seen=False;client_tail=b''
        try:
            server=socket.create_connection(('127.0.0.1',self.target_port),timeout=3)
            with self.lock:self.sockets.update((client,server))
            while not self.stop.is_set():
                ready,_,_=select.select([client,server],[],[],.2)
                for source in ready:
                    data=source.recv(65536)
                    if not data:return
                    if source is client:
                        # Parse packets may split across reads. Only inspect a bounded
                        # window for the first record INSERT after test startup.
                        text=(client_tail+data).lower();client_tail=text[-8192:]
                        if b'insert' in text and b'records' in text:insert_seen=True
                        server.sendall(data)
                    else:
                        buffer+=data
                        while len(buffer)>=5:
                            length=struct.unpack('!I',buffer[1:5])[0]
                            if length<4 or length>32*1024*1024:return
                            if len(buffer)<length+1:break
                            message,buffer=buffer[:length+1],buffer[length+1:]
                            if message[:1]==b'C' and message[5:]==b'COMMIT\0':
                                if insert_seen and self.arm.is_set():
                                    self.arm.clear();self.triggered.set();return
                                insert_seen=False;client_tail=b''
                            client.sendall(message)
        except OSError:pass
        finally:
            for sock in (client,server):
                if sock:
                    with self.lock:self.sockets.discard(sock)
                    sock.close()

    def close(self):
        self.stop.set();self.listener.close()
        with self.lock:
            for sock in list(self.sockets):
                try:sock.shutdown(socket.SHUT_RDWR)
                except OSError:pass
        self.thread.join(timeout=2)
