export default function StudentHome() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="font-display text-d2 text-ink-900">بوابة الطالب</p>
        <p className="mt-3 text-base2 text-ink-600">تأتي في المرحلة السابعة من خطة البناء.</p>
        <a href="/login" className="mt-6 inline-block text-base2 text-brand-800 hover:underline">رجوع لتسجيل الدخول</a>
      </div>
    </main>
  );
}
