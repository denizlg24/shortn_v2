import { Contact } from "@/models/Contact";
import { connectDB } from "./mongodb";

export async function createContact(data: {
  name: string;
  email: string;
  subject: string;
  company?: string;
  message: string;
  ipAddress: string;
  userAgent: string;
}): Promise<string> {
  await connectDB();

  const contact = new Contact({
    name: data.name,
    email: data.email,
    subject: data.subject,
    company: data.company,
    message: data.message,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });

  await contact.save();

  return contact.ticketId as string;
}
