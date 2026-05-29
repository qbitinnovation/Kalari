import connectDB, { getGenericModel } from "@/lib/db";
import { formatAgentId, getMaxAgentNumber, needsAgentPublicId } from "@/lib/agentId";
import { readStore, writeStore } from "@/lib/localStore";

export { needsAgentPublicId };

const sortAgentsForBackfill = <T extends { created_at?: string }>(agents: T[]) =>
  [...agents].sort((left, right) => String(left.created_at || "").localeCompare(String(right.created_at || "")));

export async function backfillAgentPublicIdsLocal(store: any) {
  store.agents = store.agents || [];
  if (!store.agents.some(needsAgentPublicId)) return { updated: 0 };

  let nextNumber = getMaxAgentNumber(store.agents);
  let updated = 0;

  sortAgentsForBackfill(store.agents).forEach((agent: any) => {
    if (!needsAgentPublicId(agent)) return;
    nextNumber += 1;
    agent.agent_code = formatAgentId(nextNumber);
    updated += 1;
  });

  return { updated };
}

export async function backfillAgentPublicIdsMongo() {
  await connectDB();
  const Agent = getGenericModel("agents") as any;

  const agents = await Agent.find({}).lean();
  if (!agents.some(needsAgentPublicId)) return { updated: 0 };

  let nextNumber = getMaxAgentNumber(agents);
  const agentUpdates: Array<{ filter: Record<string, unknown>; newId: string }> = [];

  sortAgentsForBackfill(agents).forEach((agent: any) => {
    if (!needsAgentPublicId(agent)) return;
    nextNumber += 1;
    agentUpdates.push({
      filter: agent._id ? { _id: agent._id } : { id: agent.id },
      newId: formatAgentId(nextNumber),
    });
  });

  for (const update of agentUpdates) {
    await Agent.updateOne(update.filter, { $set: { agent_code: update.newId } });
  }

  return { updated: agentUpdates.length };
}

export async function backfillAgentPublicIds() {
  try {
    return await backfillAgentPublicIdsMongo();
  } catch {
    const store = await readStore();
    const result = await backfillAgentPublicIdsLocal(store);
    if (result.updated > 0) await writeStore(store);
    return result;
  }
}
