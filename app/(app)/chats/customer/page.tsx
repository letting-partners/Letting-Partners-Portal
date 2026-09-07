import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import { FilterSelect } from "@/components/ui/TableControls";
import { getCustomerConversation, listCustomerConversations } from "@/services/chat";
import { listAssignableAgents } from "@/services/properties";
import CustomerInbox from "./CustomerInbox";

export const metadata: Metadata = { title: "Customer chats" };

export default async function CustomerChatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const inbox = await listCustomerConversations(context, {
    status: params.status,
    assigned:
      params.assigned === "me" ? "me" : params.assigned === "unassigned" ? "unassigned" : "all",
  });

  // Open the requested thread, or the newest one, so the screen is never empty
  // when there is something to read.
  const selectedId = params.conversation ?? inbox.rows[0]?.id ?? null;

  const [thread, agents] = await Promise.all([
    selectedId ? getCustomerConversation(selectedId, context) : Promise.resolve(null),
    listAssignableAgents(),
  ]);

  return (
    <>
      <PageHeader
        title="Customer chats"
        subtitle="Enquiries from the public website. Fronters never receive these."
        actions={
          <div className="row">
            <FilterSelect
              paramName="assigned"
              label="Assignment"
              allLabel="All conversations"
              options={[
                { value: "me", label: "Assigned to me" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
            <FilterSelect
              paramName="status"
              label="Status"
              allLabel="All statuses"
              options={[
                { value: "NEW", label: "New" },
                { value: "OPEN", label: "Open" },
                { value: "WAITING", label: "Waiting" },
                { value: "RESOLVED", label: "Resolved" },
              ]}
            />
          </div>
        }
      />

      <CustomerInbox
        conversations={inbox.rows.map((row) => ({
          id: row.id,
          visitorName: row.visitorName,
          subject: row.subject,
          status: row.status,
          lastMessage: row.lastMessage,
          lastMessageAt: row.lastMessageAt.toISOString(),
          unread: row.unread,
          assignedAgentName: row.assignedAgent?.fullName ?? null,
          isMine: row.isMine,
          propertyId: row.propertyId,
          propertyReference: row.propertyReference,
        }))}
        thread={
          thread
            ? {
                id: thread.conversation.id,
                visitorName: thread.conversation.visitorName,
                visitorEmail: thread.conversation.visitorEmail,
                visitorPhone: thread.conversation.visitorPhone,
                subject: thread.conversation.subject,
                status: thread.conversation.status,
                propertyId: thread.conversation.propertyId,
                propertyTitle: thread.propertyTitle ?? thread.propertyReference,
                assignedAgentName: thread.assignedAgent?.fullName ?? null,
                messages: thread.messages.map((message) => ({
                  id: message.id,
                  sender: message.sender,
                  senderName: message.senderName,
                  body: message.body,
                  isInternalNote: message.isInternalNote,
                  createdAt: message.createdAt.toISOString(),
                })),
              }
            : null
        }
        agents={agents.map((agent) => ({ id: agent.id, fullName: agent.fullName }))}
      />
    </>
  );
}
