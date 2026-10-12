const year = document.getElementById("currentYear");
if (year) year.textContent = new Date().getFullYear();

const shareButton = document.getElementById("shareLifeLink");
const shareStatus = document.getElementById("shareStatus");

if (shareButton && shareStatus) {
  shareButton.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "India-wide links to official blood stock, blood centres, donation camps, and donor registration.",
      url: window.location.origin + window.location.pathname
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareStatus.textContent = "Thanks for sharing LifeLink.";
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareData.url);
        shareStatus.textContent = "Link copied. Share it with someone who may need it.";
      } else {
        shareStatus.textContent = "Copy the page address from your browser to share this guide.";
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        shareStatus.textContent = "Copy the page address from your browser to share this guide.";
      }
    }
  });
}
