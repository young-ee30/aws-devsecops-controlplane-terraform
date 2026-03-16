import { PageHeader } from '@/components/layout/Header'

export default function CicdPage() {
  return (
    <div>
      <PageHeader
        title="CI / CD"
        subtitle="이 영역은 비워두고, 아래 Git Actions와 보안 정책 페이지를 별도로 사용합니다."
        lastUpdated="방금 전"
      />

      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <p className="text-base font-medium text-gray-700">준비 중인 페이지입니다</p>
        <p className="mt-2 text-sm text-gray-500">
          현재는 메뉴 구성을 위해 비워두었습니다. 아래의 Git Actions와 보안 정책 페이지를 사용해 주세요.
        </p>
      </div>
    </div>
  )
}
