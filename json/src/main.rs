use std::num::NonZero;

use clap::Parser;
use walkdir::WalkDir;

#[derive(Parser, Debug)]
struct Config {
    #[clap(
        short,
        long,
        default_value_t = std::thread::available_parallelism().unwrap_or(unsafe {NonZero::new_unchecked(4)}).get()-1
    )]
    threads: usize,
    #[clap(short, long, default_value_t = String::from("./"))]
    dir: String,
}

fn main() {
    let config = Config::parse();

    let walkdir = WalkDir::new(config.dir)
        .into_iter()
        .filter_map(|entry| entry.ok());

    for entry in walkdir {
        println!("{:?}", entry.path())
    }
}
