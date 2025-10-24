"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TLoginRecord } from "@/models/auth/LoginActivity";
import { format } from "date-fns";
import React, { useMemo, useState } from "react";

export const FullLoginRecordsCard = ({
  records,
}: {
  records: TLoginRecord[];
}) => {
  type IFilter =
    | "password-changed"
    | "profile-changed"
    | "login"
    | "password-change-attempt"
    | "tax-id-changed"
    | "phone-changed"
    | "email-changed"
    | "all";
  const [type, setType] = useState<IFilter>("all");
  const [sort, setSort] = useState(-1);

  const sorted = useMemo(() => {
    if (type == "all") {
      return records.sort((a, b) => {
        if (sort == 1) {
          return a.at.getTime() - b.at.getTime();
        }
        return b.at.getTime() - a.at.getTime();
      });
    }
    return records
      .filter((r) => r.type == type)
      .sort((a, b) => {
        if (sort == 1) {
          return a.at.getTime() - b.at.getTime();
        }
        return b.at.getTime() - a.at.getTime();
      });
  }, [sort, type, records]);

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <div className="flex flex-row gap-1 w-full">
        <div className="grow w-full flex flex-col gap-1 items-start">
          <p className="text-xs font-semibold text-left">
            Filter by activity type
          </p>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v as IFilter);
            }}
          >
            <SelectTrigger className="grow w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent className="z-99">
              <SelectItem value="login">login</SelectItem>
              <SelectItem value="password-changed">password-changed</SelectItem>
              <SelectItem value="profile-changed">profile-changed</SelectItem>
              <SelectItem value="password-change-attempt">
                password-change-attempt
              </SelectItem>
              <SelectItem value="tax-id-changed">tax-id-changed</SelectItem>
              <SelectItem value="phone-changed">phone-changed</SelectItem>
              <SelectItem value="email-changed">email-changed</SelectItem>
              <SelectItem value="all">all</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grow w-full flex flex-col gap-1 items-start">
          <p className="text-xs font-semibold text-left">Sort by</p>
          <Select
            value={sort == -1 ? "most-recent-first" : "oldest-first"}
            onValueChange={(v) => {
              setSort(v == "most-recent-first" ? -1 : 1);
            }}
          >
            <SelectTrigger className="grow w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent className="z-99">
              <SelectItem value="most-recent-first">
                most-recent-first
              </SelectItem>
              <SelectItem value="oldest-first">oldest-first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="w-full flex flex-col gap-2 items-start h-[50vh] max-h-[350px] overflow-y-auto">
        {sorted?.map((record) => {
          return (
            <React.Fragment key={record.at.getTime()}>
              <div className="w-full flex flex-row items-start justify-between">
                <div className="flex flex-col gap-1 items-start text-left">
                  <p className="flex flex-row items-center justify-start gap-1 font-semibold text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        record.succeeded ? "bg-green-700" : "bg-red-700",
                      )}
                    ></span>
                    {record.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.location == ", "
                      ? "Unknown location"
                      : record.location}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end text-right w-fit">
                  <p className="text-sm text-muted-foreground">
                    {format(record.at, "MMM d, yyyy h:mm a 'GMT'xxx")}
                  </p>
                  <p className="text-xs text-muted-foreground">{record.ip}</p>
                </div>
              </div>
              <Separator />
            </React.Fragment>
          );
        })}
        {!sorted ||
          (sorted.length == 0 && (
            <p className="text-xs font-semibold text-center w-full">
              No logs matching the filters.
            </p>
          ))}
      </div>
    </div>
  );
};
