
export interface PostBody {
    theme: string;
}

export interface ReqParams {
    jobId: string;
}

export interface BookData {
    title: string;
    author: string;
    currentPrice: number;
    originalPrice: number;
    description: string;
    discountAmount: number;
    discountPercentage: number;
    productUrl: string;
    valueScore: number;
    relevanceScore: number;
    summary: string;
}

export interface JobPayload {
    status: "waiting" | "active" | "completed" | "failed";
    data: BookData[] | null;
    message: string;
}
