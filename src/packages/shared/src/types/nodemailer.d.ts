declare module "nodemailer" {
  const nodemailer: {
    createTransport: (...args: any[]) => {
      sendMail: (options: any) => Promise<any>;
      verify: () => Promise<any>;
    };
  };

  export default nodemailer;
}
