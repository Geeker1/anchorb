import { logger } from "../../logger";
import { BookData } from "../../types";


const pushToMakeWebHook = async (books: BookData[], webhook_url: string) => {
    logger.info("Pushing Book Data to Make webhook")

    let rows: any[] = books.map((book: BookData)=>{
        return {
            title: book.title,
            author: book.author,
            current_price: book.currentPrice,
            original_price: book.originalPrice,
            discount_amount: book.discountAmount,
            description: book.description,
            discount_percent: book.discountPercentage,
            value_score: book.valueScore,
            relevance_score: book.relevanceScore,
            product_url: book.productUrl,
            summary: book.summary
        }
    })

    try {
        const data = { rows };

        await fetch(webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
    } catch (error) {
        logger.error(error)
    }
}

export default pushToMakeWebHook;
