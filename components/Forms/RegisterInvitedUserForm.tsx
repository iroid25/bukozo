"use client";
import { Headset, Loader2, Lock, Mail, User, Warehouse } from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { InvitedUserProps, UserProps } from "@/types/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import TextInput from "../FormInputs/TextInput";
import PasswordInput from "../FormInputs/PasswordInput";
import SubmitButton from "../FormInputs/SubmitButton";
// import { createInvitedUser } from "@/actions/users";
import CustomCarousel from "../frontend/custom-carousel";

export type OrgData = {
  name: string;
  slug: string;
  country: string;
  currency: string | undefined;
  timezone: string | undefined;
};
export default function RegisterInvitedUserForm({
  userEmail,
  orgId,
  orgName,
  roleId,
}: {
  userEmail: string;
  orgId: string;
  orgName: string;
  roleId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    formState: { errors },
    reset,
  } = useForm<InvitedUserProps>({
    defaultValues: {
      email: userEmail,
    },
  });
  const router = useRouter();
  async function onSubmit(data: InvitedUserProps) {
    setLoading(true);
    (data.orgId = orgId), (data.roleId = roleId);
    data.name = `${data.firstName} ${data.lastName}`;
    data.orgName = orgName;
    data.image =
      "https://utfs.io/f/59b606d1-9148-4f50-ae1c-e9d02322e834-2558r.png";
    try {
      // const res = await createInvitedUser(data);
      // if (res.status === 409) {
      //   setLoading(false);
      //   setEmailErr(res.error);
      // } else if (res.status === 200) {
      //   setLoading(false);
      //   toast.success("Account Created successfully", {
      //     description: "Your account has been created, Please Login",
      //   });
      //   router.push("/login");
      // } else {
      //   setLoading(false);
      //   toast.error("Something went wrong");
      // }
    } catch (error) {
      setLoading(false);
      console.error("Network Error:", error);
      toast.error("Its seems something is wrong, try again");
    }
  }
  return (
    <div className="w-full lg:grid h-screen lg:min-h-[600px] lg:grid-cols-2 relative ">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid  gap-6 mt-10 md:mt-0">
          <div className="grid gap-2 mt-10 md:mt-0">
            <h1 className="text-3xl font-bold">Welcome to {orgName} Team</h1>
            <p className="text-muted-foreground text-sm">
              Please customize your account to get started
            </p>
          </div>
          <div className="">
            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="First Name"
                  name="firstName"
                  icon={User}
                  placeholder="first Name"
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Last Name"
                  name="lastName"
                  icon={User}
                  placeholder="last Name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Phone"
                  name="phone"
                  icon={Headset}
                  placeholder="phone"
                />
                <div className="">
                  <TextInput
                    type="email"
                    register={register}
                    errors={errors}
                    label="Email Address"
                    name="email"
                    icon={Mail}
                    placeholder="email"
                    isRequired={false}
                  />
                </div>
              </div>

              <PasswordInput
                register={register}
                errors={errors}
                label="Password"
                name="password"
                icon={Lock}
                placeholder="password"
                type="password"
              />
              <div className="">
                {emailErr && (
                  <p className="text-red-500 text-xs mt-2">{emailErr}</p>
                )}
              </div>
              <div>
                <SubmitButton
                  title="Sign Up"
                  loadingTitle="Creating Please wait.."
                  loading={loading}
                  className="w-full"
                  loaderIcon={Loader2}
                  showIcon={false}
                />
              </div>
            </form>

            <p className="mt-6 text-sm text-gray-500">
              Already Registered ?{" "}
              <Link
                href="/login"
                className="font-semibold leading-6 text-rose-600 hover:text-rose-500"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        <CustomCarousel />
      </div>
    </div>
  );
}
