"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authenticate } from "@/app/actions/authenticate";
import { useState } from "react";
import { AuthError } from "next-auth";

const loginFormSchema = z.object({
  email: z.string().min(1, {
    message: "Please fill out your email or username",
  }),
  password: z.string().min(1, {
    message: "Please fill out your password.",
  }),
});

export const LoginForm = () => {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    const response = await authenticate(values);
    if (response == true) {
      console.log("HERE", response);
    } else {
      const error = response;
      if (error.name == "CredentialsSignin") {
        if (error.message.split(".")[0] === "Missing email or password") {
          form.setError("root", {
            type: "manual",
            message: "Email or password is missing.",
          });
        }
        if (
          error.message.split(".")[0] ===
          "No account found with those credentials"
        ) {
          form.setError("email", {
            type: "manual",
            message: "No account found with that email or username.",
          });
        }

        if (error.message.split(".")[0] === "Invalid password") {
          form.setError("password", {
            type: "manual",
            message: "Incorrect password.",
          });
        }
      } else {
        console.error("Unexpected error:", error);
        form.setError("root", {
          type: "manual",
          message: "Something went wrong. Please try again later.",
        });
      }
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 w-full max-w-md"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or Username</FormLabel>
              <FormControl>
                <Input placeholder="Your email or username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="*******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button disabled={loading} className="w-full" type="submit">
          {loading ? "Loading..." : "Login"}
        </Button>
      </form>
    </Form>
  );
};
