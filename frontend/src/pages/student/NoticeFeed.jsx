import React from "react";
import useFetch from "../../hooks/useFetch";
import Badge from "../../components/Badge";
import { Card, PageHeader, PageState } from "../../components/ui";
import { fmtDate } from "../../utils/format";

// Used by students and security staff
const NoticeFeed = () => {
  const { data, loading, error, reload } = useFetch("/notices/me");
  return (
    <div>
      <PageHeader title="Notices" subtitle="Announcements from the hostel administration." />
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.length === 0 && <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-muted">No notices right now.</div>}
        <div className="grid gap-4">
          {(data || []).map((n) => (
            <Card key={n._id}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {n.isPinned && <span title="Pinned">📌</span>}
                <h3 className="font-display text-lg">{n.title}</h3>
                <Badge status={n.category === "emergency" ? "high" : n.category === "general" ? "low" : "medium"} />
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink/80">{n.content}</p>
              <p className="text-xs text-muted mt-2">Posted by {n.postedBy?.name} · {fmtDate(n.createdAt)}</p>
            </Card>
          ))}
        </div>
      </PageState>
    </div>
  );
};
export default NoticeFeed;
