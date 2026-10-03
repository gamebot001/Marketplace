"use client";

import { ArrowUpRight, DollarSign, Heart, List, XCircle } from "lucide-react";
import type { CollectionActivity, ActivityType } from "@/lib/collection-detail-data";
import { c } from "./collection-detail.styles";

const ICONS: Record<ActivityType, typeof DollarSign> = {
  sale: DollarSign,
  list: List,
  transfer: ArrowUpRight,
  offer: Heart,
  cancel: XCircle,
};

export function ActivityFeed({
  activity,
  collectionName,
}: {
  activity: CollectionActivity[];
  collectionName: string;
}) {
  return (
    <div className={c("activityList")}>
      {activity.map((entry, index) => {
        const Icon = ICONS[entry.type];
        return (
          <div className={c("actRow")} key={`${entry.txHash}-${index}`}>
            <div className={c("actIcon", entry.type)}>
              <Icon aria-hidden />
            </div>
            <div className={c("actBody")}>
              <div className={c("actTitle")}>
                {entry.title} <span className={c("sub")}>by</span>{" "}
                <span className={c("from")}>{entry.to}</span>
              </div>
              <div className={c("actMeta")}>
                {collectionName} · {entry.type}
              </div>
            </div>
            <div className={c("actPrice")}>
              {entry.price === "—" ? (
                "—"
              ) : (
                <>
                  {entry.price}
                  <small>SOL</small>
                </>
              )}
            </div>
            <div className={c("actTime")}>{entry.time}</div>
          </div>
        );
      })}
    </div>
  );
}
