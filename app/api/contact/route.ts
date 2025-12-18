import { ipAddress } from "@vercel/functions";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContact } from "@/lib/contact";
import { sendContactConfirmation } from "@/lib/send-contact-confirmation";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  company: z.string().optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = contactSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { name, email, message, company, subject } = validationResult.data;

    const _ipAddress = ipAddress(request) || "unknown";

    const userAgent = request.headers.get("user-agent") || "unknown";

    const contact = await createContact({
      name,
      email,
      message,
      company,
      subject,
      ipAddress: _ipAddress,
      userAgent,
    });

    const emailResult = await sendContactConfirmation({
      to: email,
      name,
      ticketId: contact,
      message,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Contact form submitted successfully",
        ticketId: contact,
        emailSent: emailResult.success,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error submitting contact form:", error);
    return NextResponse.json(
      {
        error: "Failed to submit contact form",
      },
      { status: 500 },
    );
  }
}
