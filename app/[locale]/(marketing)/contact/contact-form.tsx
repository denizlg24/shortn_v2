"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2Icon,
  SendHorizonal,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { sendToSlack } from "@/lib/send-to-slack";

const formSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  company: z.string().optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z
    .string()
    .min(20, "Message must be at least 20 characters")
    .max(2000, "Message must be at most 2000 characters"),
});

export function ContactForm({ className }: { className?: string }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      company: "",
      subject: "",
      message: "",
    },
  });
  type StatusType = "idle" | "loading" | "success" | "error";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [status, setStatus] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [ticketId, setTicketId] = useState<string>("");
  const handleSendAnother = () => {
    setStatus("idle");
    setStatusMessage("");
    setTicketId("");
  };
  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setStatus("loading");
    setStatusMessage("");
    setTicketId("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          name: data.first_name + " " + data.last_name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus("error");
        setStatusMessage(
          result.error ||
            "There was a problem sending your message, try again later.",
        );
        return;
      }

      await sendToSlack({
        name: data.first_name + " " + data.last_name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      });

      setStatus("success");
      setStatusMessage("We've gotten your message, thank you!");
      setTicketId(result.ticketId);

      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
      setStatus("error");
      setStatusMessage(
        "There was a problem sending your message, try again later.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "success" || status === "error") {
    return (
      <div
        className="w-full min-h-[400px] flex items-center justify-center col-span-full"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {status === "success" && (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto text-foreground animate-in zoom-in duration-500" />
              <div className="space-y-3">
                <h3 className="text-2xl font-medium text-foreground">
                  {statusMessage}
                </h3>
                {ticketId && (
                  <p className="text-sm text-foreground/60">
                    Ticket ID:{" "}
                    <span className="font-mono font-semibold text-foreground/80">
                      {ticketId}
                    </span>
                  </p>
                )}
                <p className="text-sm text-foreground/50">
                  You'll receive a confirmation email shortly.
                </p>
              </div>
              <Button
                onClick={handleSendAnother}
                variant="outline"
                className="mt-8"
              >
                Send Another Message
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 mx-auto text-red-600 dark:text-red-400 animate-in zoom-in duration-500" />
              <div className="space-y-3">
                <h3 className="text-2xl font-medium text-foreground">
                  Something went wrong
                </h3>
                <p className="text-sm text-foreground/60 max-w-md mx-auto">
                  {statusMessage}
                </p>
              </div>
              <Button
                onClick={handleSendAnother}
                variant="outline"
                className="mt-8"
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      id="shortn-contact-form"
      className={"w-full col-span-full"}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup className={cn("grid grid-cols-2 gap-6", className)}>
        <Controller
          name="first_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-1">
              <FieldLabel htmlFor="shortn-contact-form-first_name">
                First Name
              </FieldLabel>
              <Input
                {...field}
                id="shortn-contact-form-first_name"
                aria-invalid={fieldState.invalid}
                placeholder="Eg: John"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="last_name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-1">
              <FieldLabel htmlFor="shortn-contact-form-last_name">
                Last Name
              </FieldLabel>
              <Input
                {...field}
                id="shortn-contact-form-last_name"
                placeholder="Eg: Doe"
                className=""
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-full">
              <FieldLabel htmlFor="shortn-contact-form-email">
                Email Address
              </FieldLabel>
              <Input
                {...field}
                id="shortn-contact-form-email"
                placeholder="Eg: john.doe@example.com"
                className=""
                type="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="company"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-full">
              <FieldLabel htmlFor="shortn-contact-form-company">
                Company (optional)
              </FieldLabel>
              <Input
                {...field}
                id="shortn-contact-form-company"
                placeholder="Eg: Acme Corporation"
                className=""
                type="text"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="subject"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-full">
              <FieldLabel htmlFor="shortn-contact-form-subject">
                Subject
              </FieldLabel>
              <Input
                {...field}
                id="shortn-contact-form-subject"
                placeholder="Eg: Inquiry about services"
                className=""
                type="text"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="message"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="col-span-full">
              <FieldLabel htmlFor="shortn-contact-form-message">
                Message
              </FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  {...field}
                  id="shortn-contact-form-message"
                  placeholder="Type your message here..."
                  rows={6}
                  className="min-h-24 resize-none"
                  aria-invalid={fieldState.invalid}
                />
                <InputGroupAddon align="block-end">
                  <InputGroupText className="tabular-nums">
                    {field.value.length}/2000 characters
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Button
        type="submit"
        className="col-span-full w-full mt-6"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send Message"}{" "}
        {isSubmitting ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <SendHorizonal />
        )}
      </Button>
    </form>
  );
}
