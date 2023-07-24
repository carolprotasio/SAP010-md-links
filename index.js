const fs = require('fs')
const fetch = require('cross-fetch')
const path = require('path')

// Função para extrair o texto do link
function extractLinks (text, filePath) {
  const regex = /\[([^[\]]*?)\]\((https?:\/\/[^\s?#.].[^\s]*)\)/gm
  const links = []
  let match

  while ((match = regex.exec(text)) !== null) {
    const linkText = match[1]
    const linkHref = match[2]

    const link = { href: linkHref, text: linkText, file: filePath }
    links.push(link)
  }

  return links
}
// Função para validar os links
function validateLinks (links) {
  const promises = links.map((link) => {
    return fetch(link.href)
      .then((response) => {
        link.status = response.status
        link.ok = response.ok ? 'OK' : 'FAIL'
        /* console.log(link)
        console.log(response.ok) */
        return link
      })
      .catch(() => {
        link.status = 404
        link.ok = 'FAIL'
        return link
      })
  })
  /* console.log(promises) */

  return Promise.all(promises)
}

// Função para as estatísticas dos links
function statsLinks (links) {
  const linksSize = links.length

  const uniqueLinks = [...new Set(links.map((link) => link.href))].length
  const brokenLinks = links.filter((link) => link.ok === 'FAIL').length
  return {
    total: linksSize,
    unique: uniqueLinks,
    broken: brokenLinks
  }
}

// Função para a leitura recursiva de diretórios
function readRecursion (absDirPath, fileCallback) {
  try {
    const files = fs.readdirSync(absDirPath)

    for (const file of files) {
      const filePath = path.join(absDirPath, file)
      const stats = fs.statSync(filePath)

      if (stats.isDirectory()) {
        readRecursion(filePath, fileCallback)
      } else if (stats.isFile() && file.endsWith('.md')) {
        fileCallback(filePath)
      }
    }
  } catch (error) {
    console.error(error)
  }
}

// FUNÇÃO PRINCIPAL DO PROJETO - ler arquivo(s) e extrair os links
function fileRead (filePath, options) {
  const extractedLinksArray = []
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`O arquivo ${filePath} não foi encontrado.`)
        }
      } else {
        if (stats.isDirectory()) {
          const markdownFiles = []
          readRecursion(filePath, (file) => {
            if (file.endsWith('.md')) {
              markdownFiles.push(file)
            }
          })
          // Cria um array de promessas para ler cada arquivo MD
          const promises = markdownFiles.map((file) => {
            return fs.promises
              .readFile(file, 'utf8')
              .then((data) => {
                const links = extractLinks(data, file)
                extractedLinksArray.push(...links)
                // Valida os links
                return validateLinks(links).then((validatedLinks) => {
                  // Calcula as estatísticas dos links
                  const statistics = statsLinks(validatedLinks)
                  // Retorna um objeto contendo o arquivo, os links validados e as estatísticas
                  return { file, links: validatedLinks, stats: statistics }
                })
              })
              .catch((error) => {
                throw error
              })
          })
          // Executa todas as promessas em paralelo usando Promise.all
          Promise.all(promises)
            .then(() => {
            // Após todas as leituras, resolve a promessa com o resultado contendo a propriedade 'links'
              resolve({ links: extractedLinksArray })
            })
            .catch((error) => {
              reject(error) // rejeita se tiver algum erro de leitura
            })
        } else if (stats.isFile() && filePath.endsWith('.md')) { // Se o caminho é um arquivo Markdown
          fs.readFile(filePath, 'utf8', (err, data) => { // Lê o conteúdo do arquivo
            if (err) {
              reject(err)
            } else {
              const links = extractLinks(data, filePath)
              validateLinks(links)
                .then((validatedLinks) => {
                  const statistics = statsLinks(validatedLinks) // Calcula as estatísticas dos links
                  resolve({ file: filePath, links: validatedLinks, stats: statistics })
                })
                .catch((error) => {
                  reject(error)
                })
            }
          })
        } else {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`O caminho ${filePath} não é um arquivo Markdown válido.`)
        }
      }
    })
  })
}

module.exports = {
  fileRead,
  validateLinks,
  statsLinks,
  extractLinks,
  readRecursion
}
