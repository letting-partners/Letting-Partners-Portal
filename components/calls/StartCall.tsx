"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { PhoneCall } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { findLandlordForOnboardingAction } from "@/app/(app)/properties/new/actions";

/*
 * Loaded when the popup opens rather than with every page. The provider sits
 * in the shell, and the wizard in particular is a large component that most
 * visits to the portal never open.
 */
const loading = () => <p className="subtle small">Loading...</p>;

const CallWorkflow = dynamic(() => import("@/app/(app)/calls/new/CallWorkflow"), { loading });

const PropertyWizard = dynamic(() => import("@/app/(app)/properties/new/PropertyWizard"), {
  loading,
});

/**
 * Making a call, in a popup.
 *
 * A call used to mean leaving whatever you were looking at: the number was
 * looked up on its own page, and a landlord who said yes sent you to a second
 * page for onboarding. Both now happen over the top of the page you were on,
 * because the caller is on the phone throughout and losing the list they were
 * working - the follow-ups due, the adverts they were reading - costs them the
 * thread of the call.
 *
 * The whole process is here: lookup, the call, its outcome, and, for a landlord
 * who is interested, the property wizard itself. Nothing navigates until the
 * property is saved.
 */

type Handover = { callId?: string; phone: string; display: string; landlordId?: string };

type StartCallOptions = { phone?: string; followUpId?: string };

type StartCallContextValue = { open: (options?: StartCallOptions) => void };

const StartCallContext = createContext<StartCallContextValue | null>(null);

export function useStartCall(): StartCallContextValue {
  const value = useContext(StartCallContext);
  if (!value) throw new Error("useStartCall must be used inside StartCallProvider.");
  return value;
}

export function StartCallProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [options, setOptions] = useState<StartCallOptions | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [existingLandlord, setExistingLandlord] =
    useState<{ id: string; name: string; phone: string } | null>(null);

  const open = useCallback((next: StartCallOptions = {}) => {
    setHandover(null);
    setExistingLandlord(null);
    setOptions(next);
  }, []);

  const close = useCallback(() => {
    setOptions(null);
    setHandover(null);
    setExistingLandlord(null);
  }, []);

  /*
   * A landlord who is already on the system skips the first wizard step, and
   * only the server can say who that landlord is. Asked once, on handover, so
   * the wizard opens on the right step rather than jumping a moment later.
   */
  const onOnboard = useCallback(
    (next: Handover) => {
      startTransition(async () => {
        const found = await findLandlordForOnboardingAction({
          landlordId: next.landlordId,
          phone: next.phone,
        });
        if (!found.ok) {
          // Not fatal: the wizard simply starts at the client step, and the
          // phone index still refuses a genuine duplicate.
          toast.error(found.error);
        }
        setExistingLandlord(found.ok ? found.data : null);
        setHandover(next);
      });
    },
    [toast],
  );

  const value = useMemo(() => ({ open }), [open]);

  return (
    <StartCallContext.Provider value={value}>
      {children}

      <Modal
        open={options !== null}
        onClose={close}
        wide={handover !== null}
        className={handover ? "modal--onboarding" : undefined}
        title={
          handover
            ? handover.landlordId
              ? "Add another property"
              : "Add landlord and property"
            : "Start call"
        }
        description={
          handover
            ? handover.landlordId
              ? "The landlord is already on the system, so this starts at the property itself."
              : "Seven steps. Everything is saved as you go."
            : "Look the number up before dialling so ownership and history are clear."
        }
      >
        {handover ? (
          <PropertyWizard
            callId={handover.callId}
            phone={handover.phone}
            display={handover.display}
            existingLandlord={existingLandlord}
            onDone={close}
          />
        ) : (
          <CallWorkflow
            // A fresh workflow per number: a popup reopened for a different
            // follow-up must not inherit the last one's state.
            key={`${options?.phone ?? ""}:${options?.followUpId ?? ""}`}
            initialPhone={options?.phone}
            initialFollowUpId={options?.followUpId}
            onOnboard={onOnboard}
            onDone={close}
          />
        )}
      </Modal>
    </StartCallContext.Provider>
  );
}

/**
 * Opens the popup. Styled as a button wherever a link to the old page was.
 */
export function StartCallButton({
  phone,
  followUpId,
  className = "btn btn--primary",
  children,
}: {
  phone?: string;
  followUpId?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { open } = useStartCall();

  return (
    <button type="button" className={className} onClick={() => open({ phone, followUpId })}>
      <PhoneCall size={15} />
      {children ?? <span>Start call</span>}
    </button>
  );
}

/**
 * Opens the popup on arrival, for anything still linking to the old
 * /calls/new address. The query string is dropped once it has been read, so
 * refreshing the call log does not reopen the popup.
 */
export function StartCallOnArrival({
  phone,
  followUpId,
}: {
  phone?: string;
  followUpId?: string;
}) {
  const { open } = useStartCall();

  useEffect(() => {
    open({ phone, followUpId });
    window.history.replaceState(null, "", window.location.pathname);
  }, [open, phone, followUpId]);

  return null;
}
