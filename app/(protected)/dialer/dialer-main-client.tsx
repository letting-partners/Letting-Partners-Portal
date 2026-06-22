"use client";

import Link from "next/link";
import { Invitation, Inviter, Registerer, RegistererState, SessionState, UserAgent, type Session } from "sip.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { createDialerCallHistory, type DialerBootstrapResponse } from "@/lib/portal-api";
import { formatDateTime } from "@/lib/format";

type ContactLite = {
  id: string;
  fullName: string;
  phoneNumber: string;
  extensionNumber: string | null;
};

type HistoryLite = {
  id: string;
  direction: "INCOMING" | "OUTGOING" | "INTERNAL";
  status: "MISSED" | "RINGING" | "ANSWERED" | "REJECTED" | "COMPLETED" | "FAILED";
  peerName: string | null;
  peerNumber: string | null;
  peerExtension: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
};

type Props = {
  bootstrap: DialerBootstrapResponse;
  contacts: ContactLite[];
  recentCalls: HistoryLite[];
  initialDialTarget?: string | null;
  autoCall?: boolean;
};

type CallStatus = "MISSED" | "RINGING" | "ANSWERED" | "REJECTED" | "COMPLETED" | "FAILED";

type RuntimeCall = {
  session: Session;
  direction: "INCOMING" | "OUTGOING" | "INTERNAL";
  peerName: string | null;
  peerNumber: string | null;
  peerExtension: string | null;
  contactId?: string;
  counterpartUserId?: string | null;
  startedAtMs: number;
  answeredAtMs: number | null;
  finalStatus?: CallStatus;
  finalized: boolean;
};

type CallView = {
  direction: "INCOMING" | "OUTGOING" | "INTERNAL";
  peerName: string | null;
  peerNumber: string | null;
  peerExtension: string | null;
  startedAtMs: number;
  answeredAtMs: number | null;
  state: "RINGING" | "ACTIVE";
  isMuted: boolean;
  isOnHold: boolean;
};

type SdhLike = {
  peerConnection?: RTCPeerConnection;
  enableSenderTracks?: (enable: boolean) => void;
  remoteMediaStream?: MediaStream;
};

type AudioWithSink = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

function fmtDuration(secondsTotal: number) {
  const m = Math.floor(secondsTotal / 60);
  const s = secondsTotal % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function peerTitle(call: { peerName: string | null; peerExtension: string | null; peerNumber: string | null }) {
  return call.peerName || call.peerExtension || call.peerNumber || "Unknown";
}

function wsCandidates(websocketHost: string | null, domain: string | null): string[] {
  const out = new Set<string>();
  const normalize = (value: string) => {
    if (value.startsWith("wss://") || value.startsWith("ws://")) return value;
    if (value.startsWith("https://")) return `wss://${value.slice(8)}`;
    if (value.startsWith("http://")) return `ws://${value.slice(7)}`;
    return `wss://${value}`;
  };
  if (websocketHost) {
    const base = normalize(websocketHost.trim());
    out.add(base);
    try {
      const parsed = new URL(base);
      if (!parsed.pathname || parsed.pathname === "/") out.add(`${base.replace(/\/+$/, "")}/ws`);
    } catch {
      out.add(`${base.replace(/\/+$/, "")}/ws`);
    }
  }
  if (domain) {
    const base = normalize(domain.trim());
    out.add(base);
    out.add(`${base.replace(/\/+$/, "")}/ws`);
  }
  return [...out];
}

function normalizeSipIdentity(value: string): string {
  return value.trim().replace(/^sips?:/i, "");
}

function registrationUriCandidates(providerUsername: string, extensionNumber: string | null, domain: string): string[] {
  const out = new Set<string>();
  const username = normalizeSipIdentity(providerUsername);
  const extension = extensionNumber?.trim();

  if (extension) {
    if (extension.includes("@")) out.add(`sip:${extension}`);
    else out.add(`sip:${extension}@${domain}`);
  }

  if (username.includes("@")) {
    out.add(`sip:${username}`);
    const userPart = username.split("@")[0]?.trim();
    if (userPart) out.add(`sip:${userPart}@${domain}`);
  } else {
    out.add(`sip:${username}@${domain}`);
  }

  return [...out];
}

function authUsernameCandidates(providerUsername: string, extensionNumber: string | null): string[] {
  const out = new Set<string>();
  const username = normalizeSipIdentity(providerUsername);
  const extension = extensionNumber?.trim();

  if (username) {
    out.add(username);
    if (username.includes("@")) {
      const userPart = username.split("@")[0]?.trim();
      if (userPart) out.add(userPart);
    }
  }
  if (extension) {
    out.add(extension.includes("@") ? extension.split("@")[0] : extension);
  }
  return [...out].filter(Boolean);
}

function normalizeWebUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function linkusLaunchUrl(linkusWebClientUrl: string | null, domain: string | null, target: string): string | null {
  const base = linkusWebClientUrl?.trim() || domain?.trim();
  if (!base) return null;
  try {
    const url = new URL(normalizeWebUrl(base));
    if (target.trim()) {
      // Common keys used by web dialers; ignored safely if unsupported by provider.
      url.searchParams.set("number", target.trim());
      url.searchParams.set("dial", target.trim());
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function DialerMainClient({ bootstrap, contacts, recentCalls, initialDialTarget = null, autoCall = false }: Props) {
  const [dialInput, setDialInput] = useState("");
  const [incomingCall, setIncomingCall] = useState<CallView | null>(null);
  const [liveCall, setLiveCall] = useState<CallView | null>(null);
  const [historyPreview, setHistoryPreview] = useState(recentCalls);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [registerState, setRegisterState] = useState<"DISCONNECTED" | "CONNECTING" | "REGISTERED" | "ERROR">("DISCONNECTED");
  const [registerTarget, setRegisterTarget] = useState<string | null>(null);
  const [registrationCycle, setRegistrationCycle] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerId, setSpeakerId] = useState("default");

  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const incomingRef = useRef<Invitation | null>(null);
  const runtimeRef = useRef<RuntimeCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);
  const shuttingDownRef = useRef(false);
  const didAutoCallRef = useRef(false);
  const isLinkusMode = bootstrap.dialerDomain.dialerMode === "LINKUS";

  const setupIssues = useMemo(() => {
    const issues: string[] = [];
    if (!bootstrap.dialerDomain.isEnabled) issues.push("dialer is disabled by admin");
    if (isLinkusMode) {
      if (!bootstrap.dialerDomain.linkusWebClientUrl?.trim() && !bootstrap.dialerDomain.domain?.trim()) {
        issues.push("add Linkus Web URL or server domain");
      }
    } else {
      if (!bootstrap.dialerDomain.domain?.trim()) issues.push("dialer domain is missing");
      if (!bootstrap.me.dialer.providerUsername?.trim()) issues.push("provider username is missing");
      if (!bootstrap.me.dialer.providerPassword?.trim()) issues.push("provider password is missing");
    }
    return issues;
  }, [
    isLinkusMode,
    bootstrap.dialerDomain.linkusWebClientUrl,
    bootstrap.dialerDomain.domain,
    bootstrap.dialerDomain.isEnabled,
    bootstrap.me.dialer.providerPassword,
    bootstrap.me.dialer.providerUsername,
  ]);
  const readyForRegistration = setupIssues.length === 0;
  const readyForCalling = isLinkusMode ? readyForRegistration : readyForRegistration && registerState === "REGISTERED";
  const websocketDisplay = useMemo(() => {
    if (isLinkusMode) return bootstrap.dialerDomain.linkusWebClientUrl || "auto: Linkus via server domain";
    if (registerTarget) return registerTarget;
    if (bootstrap.dialerDomain.websocketHost?.trim()) return bootstrap.dialerDomain.websocketHost;
    if (bootstrap.dialerDomain.domain?.trim()) return `auto: wss://${bootstrap.dialerDomain.domain}/ws`;
    return "Not set";
  }, [isLinkusMode, registerTarget, bootstrap.dialerDomain.linkusWebClientUrl, bootstrap.dialerDomain.websocketHost, bootstrap.dialerDomain.domain]);

  function clearReconnectTimer() {
    if (!reconnectTimerRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  function scheduleReconnect() {
    if (isLinkusMode) return;
    if (!isMountedRef.current || shuttingDownRef.current || !readyForRegistration) return;
    if (reconnectTimerRef.current) return;
    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    const delayMs = Math.min(15000, 1000 * (2 ** Math.min(4, attempt - 1)));
    setMessage({
      type: "error",
      text: `SIP disconnected. Reconnecting in ${Math.round(delayMs / 1000)}s...`,
    });
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!isMountedRef.current || shuttingDownRef.current) return;
      setRegistrationCycle((prev) => prev + 1);
    }, delayMs);
  }

  useEffect(() => {
    if (readyForRegistration) return;
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setRegisterState("DISCONNECTED");
    setRegisterTarget(null);
    setMessage({ type: "error", text: `Dialer not ready: ${setupIssues.join(", ")}.` });
  }, [readyForRegistration, setupIssues]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
    };
  }, []);

  async function logCall(payload: Parameters<typeof createDialerCallHistory>[0]) {
    const result = await createDialerCallHistory(payload);
    if (!result.ok) return;
    const call = result.data.call;
    setHistoryPreview((prev) => [
      {
        id: call.id,
        direction: call.direction,
        status: call.status,
        peerName: call.peerName,
        peerNumber: call.peerNumber,
        peerExtension: call.peerExtension,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        durationSec: call.durationSec,
      },
      ...prev,
    ].slice(0, 10));
  }

  function applySpeakerSelection() {
    const audio = audioRef.current as AudioWithSink | null;
    if (!audio || typeof audio.setSinkId !== "function") return;
    void audio.setSinkId(speakerId === "default" ? "" : speakerId).catch(() => {
      setMessage({ type: "error", text: "Unable to switch speaker output in this browser." });
    });
  }

  function bindRemoteAudio(session: Session) {
    const sdh = session.sessionDescriptionHandler as SdhLike | undefined;
    const pc = sdh?.peerConnection;
    const audio = audioRef.current as AudioWithSink | null;
    if (!pc || !audio) return;
    const stream = sdh?.remoteMediaStream ?? new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track && !stream.getTracks().includes(receiver.track)) stream.addTrack(receiver.track);
    });
    pc.ontrack = (event: RTCTrackEvent) => {
      event.streams.forEach((incomingStream) => {
        incomingStream.getTracks().forEach((track) => {
          if (!stream.getTracks().includes(track)) stream.addTrack(track);
        });
      });
      audio.srcObject = stream;
      void audio.play().catch(() => {});
    };
    audio.srcObject = stream;
    void audio.play().catch(() => {});
    if (typeof audio.setSinkId === "function") {
      void audio.setSinkId(speakerId === "default" ? "" : speakerId).catch(() => {});
    }
  }

  async function finalize(runtime: RuntimeCall, forced?: CallStatus) {
    if (runtime.finalized) return;
    runtime.finalized = true;
    runtimeRef.current = null;
    incomingRef.current = null;
    setIncomingCall(null);
    setLiveCall(null);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const endedAtMs = Date.now();
    const status = forced ?? runtime.finalStatus ?? (runtime.answeredAtMs ? "COMPLETED" : runtime.direction === "INCOMING" ? "MISSED" : "FAILED");
    const durationSec = runtime.answeredAtMs ? Math.max(0, Math.floor((endedAtMs - runtime.answeredAtMs) / 1000)) : 0;
    await logCall({
      direction: runtime.direction,
      status,
      contactId: runtime.contactId,
      counterpartUserId: runtime.counterpartUserId ?? null,
      peerName: runtime.peerName,
      peerNumber: runtime.peerNumber,
      peerExtension: runtime.peerExtension,
      startedAt: new Date(runtime.startedAtMs).toISOString(),
      answeredAt: runtime.answeredAtMs ? new Date(runtime.answeredAtMs).toISOString() : null,
      endedAt: new Date(endedAtMs).toISOString(),
      durationSec,
    });
  }

  function hookSession(runtime: RuntimeCall) {
    runtime.session.stateChange.addListener((state) => {
      if (state === SessionState.Established) {
        runtime.answeredAtMs = Date.now();
        setIncomingCall(null);
        setLiveCall((prev) => (prev ? { ...prev, answeredAtMs: runtime.answeredAtMs, state: "ACTIVE" } : prev));
        bindRemoteAudio(runtime.session);
        if (!tickRef.current) tickRef.current = setInterval(() => setNowMs(Date.now()), 1000);
      }
      if (state === SessionState.Terminated) void finalize(runtime);
    });
  }

  async function callTarget(target: string, metadata: Omit<RuntimeCall, "session" | "startedAtMs" | "answeredAtMs" | "finalized">) {
    if (!readyForCalling) {
      setMessage({ type: "error", text: isLinkusMode ? "Dialer is not ready." : "Dialer is not registered." });
      return;
    }
    if (runtimeRef.current || incomingRef.current) {
      setMessage({ type: "error", text: "Finish current call first." });
      return;
    }

    if (isLinkusMode) {
      const launch = linkusLaunchUrl(bootstrap.dialerDomain.linkusWebClientUrl, bootstrap.dialerDomain.domain, target);
      if (!launch) {
        setMessage({ type: "error", text: "Linkus launch URL is missing. Set Linkus URL or domain in Dialer Settings." });
        return;
      }
      const popup = window.open(launch, "_blank", "noopener,noreferrer");
      if (!popup) {
        setMessage({ type: "error", text: "Popup blocked. Allow popups, then click Call again." });
        return;
      }
      setMessage({ type: "success", text: "Linkus opened in a new tab. Continue the call there." });
      const startedAt = new Date().toISOString();
      await logCall({
        direction: metadata.direction,
        status: "RINGING",
        contactId: metadata.contactId,
        counterpartUserId: metadata.counterpartUserId ?? null,
        peerName: metadata.peerName,
        peerNumber: metadata.peerNumber,
        peerExtension: metadata.peerExtension,
        startedAt,
        endedAt: startedAt,
        durationSec: 0,
        notes: "Call handed off to Linkus web client.",
      });
      return;
    }

    const ua = userAgentRef.current;
    if (!ua) return;
    const domain = bootstrap.dialerDomain.domain!;
    const uri = target.startsWith("sip:") ? target : target.includes("@") ? `sip:${target}` : `sip:${target}@${domain}`;
    const targetUri = UserAgent.makeURI(uri);
    if (!targetUri) return;

    const inviter = new Inviter(ua, targetUri, { sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } });
    const startedAtMs = Date.now();
    const runtime: RuntimeCall = { ...metadata, session: inviter, startedAtMs, answeredAtMs: null, finalized: false };
    runtimeRef.current = runtime;
    setLiveCall({
      direction: runtime.direction,
      peerName: runtime.peerName,
      peerNumber: runtime.peerNumber,
      peerExtension: runtime.peerExtension,
      startedAtMs,
      answeredAtMs: null,
      state: "RINGING",
      isMuted: false,
      isOnHold: false,
    });
    hookSession(runtime);
    try {
      await inviter.invite({ sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } });
    } catch {
      runtime.finalStatus = "FAILED";
      await finalize(runtime, "FAILED");
      setMessage({ type: "error", text: "Call setup failed." });
    }
  }

  async function answerIncoming() {
    const invitation = incomingRef.current;
    if (!invitation) return;
    try {
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    } catch {
      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.finalStatus = "FAILED";
        await finalize(runtime, "FAILED");
      }
      setMessage({ type: "error", text: "Failed to answer call." });
    }
  }

  async function rejectIncoming(status: "REJECTED" | "MISSED") {
    const invitation = incomingRef.current;
    const runtime = runtimeRef.current;
    if (!invitation || !runtime) return;
    runtime.finalStatus = status;
    try {
      await invitation.reject({
        statusCode: status === "MISSED" ? 480 : 486,
        reasonPhrase: status === "MISSED" ? "No Answer" : "Rejected",
      });
    } catch {
      await finalize(runtime, status);
    }
  }

  async function hangup() {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.finalStatus = runtime.answeredAtMs ? "COMPLETED" : "FAILED";
    try {
      if (runtime.session.state === SessionState.Established) await runtime.session.bye();
      else if (runtime.session instanceof Inviter) await runtime.session.cancel();
      else if (runtime.session instanceof Invitation) await runtime.session.reject({ statusCode: 486 });
    } catch {
      await finalize(runtime, runtime.finalStatus);
    }
  }

  useEffect(() => {
    const start = async () => {
      if (!readyForRegistration) return;
      if (isLinkusMode) {
        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        setRegisterTarget(null);
        setRegisterState("REGISTERED");
        setMessage(null);
        return;
      }
      shuttingDownRef.current = false;
      const username = normalizeSipIdentity(bootstrap.me.dialer.providerUsername!);
      const password = bootstrap.me.dialer.providerPassword!;
      const domain = bootstrap.dialerDomain.domain!;
      const candidates = wsCandidates(bootstrap.dialerDomain.websocketHost, domain);
      const uriCandidates = registrationUriCandidates(
        username,
        bootstrap.me.dialer.extensionNumber,
        domain,
      );
      const authCandidates = authUsernameCandidates(username, bootstrap.me.dialer.extensionNumber);
      setRegisterState("CONNECTING");
      for (const server of candidates) {
        for (const uriCandidate of uriCandidates) {
          for (const authUsername of authCandidates) {
            const uri = UserAgent.makeURI(uriCandidate);
            if (!uri) continue;
            const ua = new UserAgent({
              uri,
              authorizationUsername: authUsername,
              authorizationPassword: password,
              displayName: bootstrap.me.dialer.extensionName || bootstrap.me.name,
              transportOptions: { server },
              delegate: {
                onInvite: (invitation: Invitation) => {
                  if (runtimeRef.current || incomingRef.current) {
                    void invitation.reject({ statusCode: 486, reasonPhrase: "Busy" });
                    return;
                  }
                  const ext = invitation.remoteIdentity.uri.user ?? null;
                  const contact = contacts.find((c) => c.extensionNumber === ext || c.phoneNumber === ext);
                  const intercom = bootstrap.intercomAgents.find((a) => a.extensionNumber === ext);
                  const startedAtMs = Date.now();
                  const runtime: RuntimeCall = {
                    session: invitation,
                    direction: intercom ? "INTERNAL" : "INCOMING",
                    peerName: invitation.remoteIdentity.displayName || ext,
                    peerNumber: contact?.phoneNumber ?? null,
                    peerExtension: ext,
                    contactId: contact?.id,
                    counterpartUserId: intercom?.id ?? null,
                    startedAtMs,
                    answeredAtMs: null,
                    finalized: false,
                  };
                  runtimeRef.current = runtime;
                  incomingRef.current = invitation;
                  setIncomingCall({ ...runtime, state: "RINGING", isMuted: false, isOnHold: false });
                  setLiveCall({ ...runtime, state: "RINGING", isMuted: false, isOnHold: false });
                  hookSession(runtime);
                },
              },
            });
            const registerer = new Registerer(ua);
            registerer.stateChange.addListener((state) => {
              if (state === RegistererState.Registered) {
                clearReconnectTimer();
                reconnectAttemptRef.current = 0;
                setRegisterState("REGISTERED");
                setMessage(null);
              }
              if (state === RegistererState.Unregistered || state === RegistererState.Terminated) {
                setRegisterState("DISCONNECTED");
                if (!shuttingDownRef.current) scheduleReconnect();
              }
            });
            try {
              await ua.start();
              await registerer.register();
              userAgentRef.current = ua;
              registererRef.current = registerer;
              setRegisterState("REGISTERED");
              setRegisterTarget(server);
              setMessage(null);
              clearReconnectTimer();
              reconnectAttemptRef.current = 0;
              return;
            } catch {
              try { await ua.stop(); } catch {}
            }
          }
        }
      }
      setRegisterState("ERROR");
      setMessage({
        type: "error",
        text: "SIP registration failed. Check provider WebSocket support, domain, extension/AOR, and credentials.",
      });
      scheduleReconnect();
    };
    void start();
    return () => {
      const cleanup = async () => {
        if (isLinkusMode) return;
        shuttingDownRef.current = true;
        const runtime = runtimeRef.current;
        if (runtime && !runtime.finalized) await finalize(runtime, "FAILED");
        const reg = registererRef.current;
        const ua = userAgentRef.current;
        registererRef.current = null;
        userAgentRef.current = null;
        if (reg) { try { await reg.unregister(); } catch {} }
        if (ua) { try { await ua.stop(); } catch {} }
      };
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationCycle, readyForRegistration, isLinkusMode, bootstrap.dialerDomain.domain, bootstrap.dialerDomain.websocketHost, bootstrap.me.dialer.providerUsername, bootstrap.me.dialer.providerPassword, bootstrap.me.dialer.extensionNumber, bootstrap.me.dialer.extensionName, bootstrap.me.name]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const load = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setSpeakerDevices(devices.filter((d) => d.kind === "audiooutput"));
      } catch {}
    };
    void load();
    const onChange = () => void load();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, []);

  useEffect(() => {
    applySpeakerSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerId]);

  const duration = liveCall ? fmtDuration(Math.max(0, Math.floor((nowMs - (liveCall.answeredAtMs ?? liveCall.startedAtMs)) / 1000))) : "00:00";
  const callDisabled = !readyForCalling || Boolean(runtimeRef.current || incomingRef.current);

  useEffect(() => {
    if (!initialDialTarget) return;
    setDialInput(initialDialTarget);
  }, [initialDialTarget]);

  useEffect(() => {
    didAutoCallRef.current = false;
  }, [initialDialTarget, autoCall]);

  const callFromDialInput = () => {
    const target = dialInput.trim();
    if (!target) return;
    const matchingContact = contacts.find((c) => c.phoneNumber === target || c.extensionNumber === target);
    void callTarget(target, {
      direction: "OUTGOING",
      peerName: matchingContact?.fullName ?? null,
      peerNumber: matchingContact ? matchingContact.phoneNumber : target,
      peerExtension: matchingContact?.extensionNumber ?? null,
      contactId: matchingContact?.id,
    });
  };

  useEffect(() => {
    if (!autoCall || didAutoCallRef.current || !initialDialTarget || !readyForCalling || isLinkusMode) return;
    if (runtimeRef.current || incomingRef.current) return;
    const target = initialDialTarget.trim();
    if (!target) return;
    didAutoCallRef.current = true;
    const matchingContact = contacts.find((c) => c.phoneNumber === target || c.extensionNumber === target);
    void callTarget(target, {
      direction: "OUTGOING",
      peerName: matchingContact?.fullName ?? null,
      peerNumber: matchingContact ? matchingContact.phoneNumber : target,
      peerExtension: matchingContact?.extensionNumber ?? null,
      contactId: matchingContact?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCall, initialDialTarget, readyForCalling, contacts, isLinkusMode]);

  return (
    <div className="stack">
      <audio ref={audioRef} autoPlay playsInline />
      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="dialer-premium-grid">
        <section className="dialer-card dialer-recent-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">Recent Calls</h2>
            <Link href="/dialer/history" className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>
          {historyPreview.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No calls yet. Place your first call from the dialpad.
            </p>
          ) : (
            <div className="dialer-recent-list">
              {historyPreview.slice(0, 8).map((call) => {
                const target = (call.peerNumber || call.peerExtension || "").trim();
                const redialDirection = call.direction === "INTERNAL" ? "INTERNAL" : "OUTGOING";
                return (
                  <article key={call.id} className="dialer-recent-item">
                    <div>
                      <p className="dialer-agent-name">{call.peerName || call.peerExtension || call.peerNumber || "Unknown"}</p>
                      <p className="dialer-agent-meta">
                        {call.direction} | {fmtDuration(call.durationSec)} | {formatDateTime(call.startedAt)}
                      </p>
                    </div>
                    <div className="inline-row">
                      <span
                        className={`badge ${
                          call.status === "COMPLETED" || call.status === "ANSWERED"
                            ? "badge-active"
                            : call.status === "MISSED" || call.status === "FAILED" || call.status === "REJECTED"
                              ? "badge-locked"
                              : "badge-warning"
                        }`}
                      >
                        {call.status}
                      </span>
                      <UIButton
                        variant="secondary"
                        onClick={() => {
                          if (!target) return;
                          setDialInput(target);
                          void callTarget(target, {
                            direction: redialDirection,
                            peerName: call.peerName,
                            peerNumber: call.peerNumber ?? (redialDirection === "OUTGOING" ? target : null),
                            peerExtension: call.peerExtension ?? (redialDirection === "INTERNAL" ? target : null),
                          });
                        }}
                        disabled={callDisabled || !target}
                      >
                        Redial
                      </UIButton>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dialer-card dialer-dialpad-card dialer-premium-pad">
          <div className="dialer-premium-head">
            <div>
              <h2 className="dialer-card-title">Premium Dialpad</h2>
              <p className="dialer-premium-subtitle">Fast input, clean audio routing, and instant call actions.</p>
            </div>
            <span className={`badge ${registerState === "REGISTERED" ? "badge-active" : registerState === "CONNECTING" ? "badge-warning" : "badge-locked"}`}>
              {registerState}
            </span>
          </div>
          <div className="dialer-dialer-wrap">
            <div className="dialer-premium-input-row">
              <UIInput
                value={dialInput}
                onChange={(event) => setDialInput(event.target.value)}
                placeholder="Enter number or extension"
                className="dialer-dial-input dialer-dial-input-premium"
              />
              <select className="select" value={speakerId} onChange={(event) => setSpeakerId(event.target.value)} style={{ minWidth: 180 }}>
                <option value="default">Speaker: Default</option>
                {speakerDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Speaker"}</option>)}
              </select>
            </div>
            <div className="dialer-key-grid dialer-key-grid-premium">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                <button key={digit} type="button" className="dialer-key" onClick={() => setDialInput((prev) => `${prev}${digit}`)}>{digit}</button>
              ))}
            </div>
            <div className="inline-row">
              <UIButton onClick={callFromDialInput} disabled={callDisabled || !dialInput.trim()}>Call</UIButton>
              <UIButton variant="secondary" onClick={() => setDialInput((prev) => prev.slice(0, -1))} disabled={!dialInput.length}>Backspace</UIButton>
              <UIButton variant="secondary" onClick={() => setDialInput("")} disabled={!dialInput.length}>Clear</UIButton>
            </div>
          </div>
        </section>
      </div>

      <section className="dialer-card dialer-status-card">
        <div className="dialer-card-head">
          <h2 className="dialer-card-title">Dialer Status & Connection Details</h2>
          <span className={`badge ${readyForCalling ? "badge-active" : "badge-warning"}`}>
            {readyForCalling ? "Ready" : "Waiting"}
          </span>
        </div>
        <div className="dialer-connection-list">
          <div className="dialer-connection-item"><span>Mode</span><strong>{isLinkusMode ? "LINKUS" : "SIP"}</strong></div>
          <div className="dialer-connection-item"><span>Domain</span><strong>{bootstrap.dialerDomain.domain ?? "Not set"}</strong></div>
          <div className="dialer-connection-item"><span>{isLinkusMode ? "Linkus URL" : "WebSocket"}</span><strong>{websocketDisplay}</strong></div>
          <div className="dialer-connection-item"><span>Extension</span><strong>{bootstrap.me.dialer.extensionNumber ?? bootstrap.me.dialer.providerUsername ?? "Not set"}</strong></div>
        </div>
        <p className="dialer-connection-foot">Domain updated: {bootstrap.dialerDomain.updatedAt ? formatDateTime(bootstrap.dialerDomain.updatedAt) : "Never"}</p>
      </section>

      {!isLinkusMode && incomingCall && (
        <section className="dialer-card dialer-incoming-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">Incoming Call</h2>
            <span className="badge badge-warning">Ringing</span>
          </div>
          <div className="dialer-incoming-body">
            <p className="dialer-incoming-title">{peerTitle(incomingCall)}</p>
            <p className="dialer-incoming-sub">{incomingCall.peerNumber || incomingCall.peerExtension || "Unknown source"}</p>
            <div className="inline-row">
              <UIButton onClick={() => void answerIncoming()}>Answer</UIButton>
              <UIButton variant="danger" onClick={() => void rejectIncoming("REJECTED")}>Reject</UIButton>
              <UIButton variant="secondary" onClick={() => void rejectIncoming("MISSED")}>Mark Missed</UIButton>
            </div>
          </div>
        </section>
      )}

      {!isLinkusMode && liveCall && (
        <section className="dialer-card dialer-live-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">{liveCall.direction === "INTERNAL" ? "Internal Call" : "Live Call"} | {peerTitle(liveCall)}</h2>
            <span className={`badge ${liveCall.state === "ACTIVE" ? "badge-active" : "badge-warning"}`}>{liveCall.state === "ACTIVE" ? "In Call" : "Connecting"}</span>
          </div>
          <div className="dialer-live-meta">
            <p className="dialer-live-duration">{duration}</p>
            <p className="dialer-live-peer">{liveCall.peerNumber || liveCall.peerExtension || "No number"}</p>
          </div>
          <div className="dialer-live-controls">
            <button type="button" className={`dialer-live-control${liveCall.isMuted ? " active" : ""}`} onClick={() => {
              const runtime = runtimeRef.current; if (!runtime) return;
              const muted = !liveCall.isMuted;
              const sdh = runtime.session.sessionDescriptionHandler as SdhLike | undefined;
              if (sdh?.enableSenderTracks) sdh.enableSenderTracks(!muted);
              setLiveCall((prev) => (prev ? { ...prev, isMuted: muted } : prev));
            }}>{liveCall.isMuted ? "Unmute" : "Mute"}</button>
            <button type="button" className={`dialer-live-control${liveCall.isOnHold ? " active" : ""}`} onClick={() => {
              const runtime = runtimeRef.current; if (!runtime || runtime.session.state !== SessionState.Established) return;
              const hold = !liveCall.isOnHold;
              void runtime.session
                .invite({ sessionDescriptionHandlerOptions: { hold } as unknown as object })
                .then(() => {
                setLiveCall((prev) => (prev ? { ...prev, isOnHold: hold } : prev));
              });
            }} disabled={liveCall.state !== "ACTIVE"}>{liveCall.isOnHold ? "Resume" : "Hold"}</button>
            <button type="button" className="dialer-live-end" onClick={() => void hangup()}>End Call</button>
          </div>
        </section>
      )}
    </div>
  );
}
